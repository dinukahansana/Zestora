import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createApp } from '../src/app.ts';
import { Session, User } from '../src/auth/models.ts';
import { Category, Product } from '../src/catalogue/models.ts';
import { productInput, productValues } from '../src/catalogue/schemas.ts';
import { readConfig } from '../src/config.ts';
import { connectDatabase, disconnectDatabase } from '../src/database.ts';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const origin = 'http://127.0.0.1:5173';
const config = readConfig({ NODE_ENV: 'test', ALLOWED_ORIGINS: origin });
const app = createApp(config);
const password = randomBytes(18).toString('base64url');
const demoEmail = 'shop-owner@zestora.example';
let database: MongoMemoryReplSet | undefined;

async function script(name: string, environment: NodeJS.ProcessEnv = {}) {
  if (!database) throw new Error('MongoDB was not started.');
  return run(process.execPath, ['scripts/' + name + '.mts'], {
    cwd: root,
    env: { ...process.env, MONGODB_URI: database.getUri('zestora_api_test'), ...environment },
  });
}

beforeAll(async () => {
  const offline = await request(app).get('/api/ready').expect(503);
  expect(offline.body.database).toBe('disconnected');
  await request(app).get('/api/health').expect(200);
  await request(app).get('/api/products').expect(503);
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDatabase(database.getUri('zestora_api_test'));
  await script('seed-demo');
}, 180000);

afterAll(async () => {
  await disconnectDatabase();
  await database?.stop();
}, 20000);

describe('catalogue and health', () => {
  test('liveness stays minimal and readiness reflects MongoDB', async () => {
    const health = await request(app).get('/api/health').expect(200);
    expect(health.body).toEqual({ status: 'ok', service: 'zestora-api' });
    expect(health.headers['x-powered-by']).toBeUndefined();
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    const ready = await request(app).get('/api/ready').expect(200);
    expect(ready.body.database).toBe('connected');
    await request(app).get('/api/nonexistent').expect(404);
  });

  test('seeding preserves existing records and returns published bilingual data', async () => {
    await script('seed-demo');
    await Category.create({ slug: 'private', name: { en: 'Private', si: 'පුද්ගලික' }, position: 9, published: false });
    const hiddenProduct = productInput.parse({
      slug: 'hidden-example', category: 'private',
      name: { en: 'Hidden', si: 'සැඟවුණු' }, description: { en: 'Hidden', si: 'සැඟවුණු' },
      ingredients: [], image: '/images/mango.webp',
      sizes: [{ id: 'regular', name: { en: 'Regular', si: 'සාමාන්‍ය' }, price: 300 }], addOns: [],
    });
    await Product.create(productValues(hiddenProduct));
    const catalogue = await request(app).get('/api/catalogue').expect(200);
    expect(catalogue.body.categories).toHaveLength(6);
    expect(catalogue.body.products).toHaveLength(6);
    const product = catalogue.body.products.find((item: { slug: string }) => item.slug === 'golden-mango');
    expect(product).toMatchObject({ demo: true, startingPrice: 690, name: { en: 'Golden Mango', si: 'රන්වන් අඹ' } });
    expect(product).not.toHaveProperty('_id');
    await request(app).get('/api/products/hidden-example').expect(404);
    const list = await request(app).get('/api/products?category=juices&available=true&limit=1&sort=low').expect(200);
    expect(list.body).toMatchObject({ total: 1, limit: 1, offset: 0 });
    expect(list.body.items[0].slug).toBe('golden-mango');
    await request(app).get('/api/products?limit=101').expect(400);
    await request(app).get('/api/products?category%5B%5D=juices').expect(400);
  });
});

describe('account sessions', () => {
  test('registration hashes a password, rejects role assignment and issues an HttpOnly cookie', async () => {
    const client = request.agent(app);
    const values = { name: 'Demo Customer', email: 'CUSTOMER@zestora.example', password };
    const rejected = await client.post('/api/auth/register').send({ ...values, role: 'admin' }).expect(400);
    expect(rejected.body.error.code).toBe('INVALID_INPUT');
    const response = await client.post('/api/auth/register').set('Origin', origin).send(values).expect(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.body.user).toMatchObject({ email: 'customer@zestora.example', role: 'customer' });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    const cookies = response.get('set-cookie');
    expect(cookies?.[0]).toMatch(/HttpOnly.*SameSite=Lax/);
    const user = await User.findOne({ email: 'customer@zestora.example' }).select('+passwordHash');
    expect(user?.passwordHash).toMatch(/^scrypt1\./);
    expect(user?.passwordHash).not.toContain(password);
    expect((await Session.findOne({ userId: user?._id }))?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    await client.get('/api/auth/me').expect(200);
    await client.get('/api/admin/catalogue').expect(403);
    await client.post('/api/auth/logout').expect(204);
    await client.get('/api/auth/me').expect(401);
    await client.post('/api/auth/login').send({ email: values.email, password }).expect(200);
  });

  test('login gives the same error for an unknown email and an invalid password', async () => {
    const wrongPassword = randomBytes(18).toString('base64url');
    const existing = await request(app).post('/api/auth/login').send({ email: 'customer@zestora.example', password: wrongPassword }).expect(401);
    const unknown = await request(app).post('/api/auth/login').send({ email: 'unknown@zestora.example', password: wrongPassword }).expect(401);
    expect(existing.body).toEqual(unknown.body);
  });

  test('the admin bootstrap is explicit and production cookies require HTTPS', async () => {
    const values = { ADMIN_NAME: 'Demo Owner', ADMIN_EMAIL: demoEmail, ADMIN_PASSWORD: password };
    await script('create-admin', values);
    await expect(script('create-admin', values)).rejects.toMatchObject({ code: 1 });
    const client = request.agent(app);
    await client.get('/api/admin/catalogue').expect(401);
    await client.post('/api/auth/login').send({ email: demoEmail, password }).expect(200);
    const result = await client.get('/api/admin/catalogue').expect(200);
    expect(result.body.products.map((item: { slug: string }) => item.slug)).toContain('hidden-example');

    const secureApp = createApp(readConfig({ NODE_ENV: 'production' }));
    const response = await request(secureApp).post('/api/auth/login').send({ email: demoEmail, password }).expect(200);
    expect(response.get('set-cookie')?.[0]).toMatch(/^__Host-zestora-session=.*HttpOnly; Secure; SameSite=Lax/);
  });

  test('expired sessions are rejected even before TTL cleanup runs', async () => {
    const client = request.agent(app);
    await client.post('/api/auth/login').send({ email: demoEmail, password }).expect(200);
    const user = await User.findOne({ email: demoEmail });
    await Session.updateMany({ userId: user?._id }, { expiresAt: new Date(0) });
    await client.get('/api/auth/me').expect(401);
  });
});

test('mutation origins, malformed JSON, and authentication rate limits are enforced', async () => {
  const denied = await request(app).post('/api/auth/logout').set('Origin', 'https://untrusted.example').expect(403);
  expect(denied.body.error.code).toBe('ORIGIN_FORBIDDEN');
  await request(app).post('/api/auth/logout').set('Sec-Fetch-Site', 'cross-site').expect(403);
  await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"invalid":').expect(400);
  await request(app).post('/api/auth/login').send({ password: 'x'.repeat(70000) }).expect(413);

  const limited = createApp(config);
  for (let index = 0; index < 15; index += 1) {
    await request(limited).post('/api/auth/login').send({}).expect(400);
  }
  const response = await request(limited).post('/api/auth/login').send({}).expect(429);
  expect(response.body.error.code).toBe('TOO_MANY_REQUESTS');
});

test('database readiness and catalogue recover after a reconnect', async () => {
  if (!database) throw new Error('MongoDB was not started.');
  await disconnectDatabase();
  await request(app).get('/api/catalogue').expect(503);
  await connectDatabase(database.getUri('zestora_api_test'));
  await request(app).get('/api/ready').expect(200);
  await request(app).get('/api/catalogue').expect(200);
});
