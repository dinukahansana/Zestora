import { execFile } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import request from 'supertest';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { createApp } from '../src/app.ts';
import { Session, User } from '../src/auth/models.ts';
import { Category, Product } from '../src/catalogue/models.ts';
import { productInput, productValues } from '../src/catalogue/schemas.ts';
import { readConfig } from '../src/config.ts';
import { connectDatabase, disconnectDatabase } from '../src/database.ts';
import type { Email } from '../src/mail.ts';
import { Notification } from '../src/notifications.ts';
import { Payment } from '../src/payments/models.ts';
import { Coupon, Order } from '../src/ordering/models.ts';

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
  }, 15000);

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

const guestKey = () => randomBytes(32).toString('base64url');
const mango = { productSlug: 'golden-mango', sizeId: 'large', addOnIds: ['chia'], quantity: 2 };
const pickup = { type: 'pickup' };
const buyer = { name: 'Demo Buyer', email: 'buyer@zestora.example', phone: '+94 71 000 0000' };

describe('ordering and profiles', () => {
  test('the server prices choices, coupons and delivery from the database', async () => {
    const quote = { items: [mango], coupon: 'fresh10', fulfillment: { type: 'delivery', zoneId: 'colombo' } };
    const response = await request(app).post('/api/orders/quote').send(quote).expect(200);
    expect(response.body.totals).toEqual({ subtotal: 1940, discount: 194, deliveryFee: 150, total: 1896 });
    await request(app).post('/api/orders/quote').send({ ...quote, total: 1 }).expect(400);
    await request(app).post('/api/orders/quote').send({ ...quote, coupon: 'INVALID' }).expect(400);
    await request(app).post('/api/orders/quote').send({ ...quote, items: [{ ...mango, sizeId: 'unavailable' }] }).expect(400);
    expect(await Order.countDocuments()).toBe(0);
  });

  test('guest checkout is idempotent and tracking needs the separate key', async () => {
    const body = { items: [mango], fulfillment: pickup, customer: buyer, expectedTotal: 1940, checkoutKey: randomUUID(), guestKey: guestKey() };
    const stale = await request(app).post('/api/orders').send({ ...body, expectedTotal: 1 }).expect(409);
    expect(stale.body.error.code).toBe('TOTAL_CHANGED');
    const created = await request(app).post('/api/orders').send(body).expect(201);
    const { order } = created.body;
    expect(order).toMatchObject({ orderStatus: 'pending', paymentStatus: 'pending', paymentMethod: 'cash_pickup', totals: { total: 1940 } });
    expect(created.text).not.toContain(body.guestKey);
    expect(order).not.toHaveProperty('fingerprint');
    const repeated = await request(app).post('/api/orders').send(body).expect(200);
    expect(repeated.body.order.reference).toBe(order.reference);
    expect(await Order.countDocuments({ checkoutKey: body.checkoutKey })).toBe(1);
    await request(app).post('/api/orders').send({ ...body, notes: 'Different order' }).expect(409);
    await request(app).post('/api/orders/track').send({ reference: order.reference, key: guestKey() }).expect(404);
    await request(app).post('/api/orders/track').send({ reference: order.reference, key: body.guestKey }).expect(200);
    await request(app).get('/api/orders/mine').expect(401);
  });

  test('two concurrent requests cannot both redeem a one-use coupon', async () => {
    const isolated = createApp(config);
    await Coupon.create({ code: 'ONCE', type: 'percent', value: 10, active: true, uses: 0, usageLimit: 1 });
    const submit = () => request(isolated).post('/api/orders').send({
      items: [{ ...mango, sizeId: 'regular', quantity: 1, addOnIds: [] }], coupon: 'ONCE', fulfillment: pickup,
      customer: buyer, expectedTotal: 621, checkoutKey: randomUUID(), guestKey: guestKey(),
    });
    const attempts = await Promise.all([submit(), submit()]);
    expect(attempts.map(result => result.status).sort()).toEqual([201, 400]);
    expect(await Order.countDocuments({ coupon: 'ONCE' })).toBe(1);
    expect((await Coupon.findOne({ code: 'ONCE' }))?.uses).toBe(1);
  });

  test('account orders and saved addresses belong to the authenticated customer', async () => {
    const customer = request.agent(app);
    const stranger = request.agent(app);
    await customer.post('/api/auth/register').send({ name: buyer.name, email: buyer.email, password }).expect(201);
    await stranger.post('/api/auth/register').send({ name: 'Other Buyer', email: 'other-buyer@zestora.example', password }).expect(201);
    const created = await customer.post('/api/orders').send({
      items: [mango], fulfillment: pickup, customer: buyer, expectedTotal: 1940, checkoutKey: randomUUID(),
    }).expect(201);
    const ref = created.body.order.reference;
    const mine = await customer.get('/api/orders/mine').expect(200);
    expect(mine.body.orders.map((order: { reference: string }) => order.reference)).toContain(ref);
    await stranger.get('/api/orders/mine/' + ref).expect(404);
    await customer.get('/api/orders/mine/' + ref).expect(200);

    await customer.patch('/api/account').send({ name: 'Updated Name' }).expect(200);
    const result = await customer.post('/api/account/addresses').send({ label: 'Home', address: 'Demo address in Colombo' }).expect(201);
    const id = result.body.addresses[0]._id;
    await stranger.patch('/api/account/addresses/' + id).send({ label: 'Outside', address: 'Another demo address' }).expect(404);
    const updated = await customer.patch('/api/account/addresses/' + id).send({ label: 'Office', address: 'Updated demo address' }).expect(200);
    expect(updated.body.addresses[0]).toMatchObject({ label: 'Office' });
    await customer.delete('/api/account/addresses/' + id).expect(204);
    const profile = await customer.get('/api/account').expect(200);
    expect(profile.body).toMatchObject({ user: { name: 'Updated Name' }, addresses: [] });
  });
});

test('a reset link is single use and revokes existing sessions', async () => {
  const messages: Email[] = [];
  const emailApp = createApp(config, async message => { messages.push(message); });
  const client = request.agent(emailApp);
  const email = 'reset-customer@zestora.example';
  await client.post('/api/auth/register').send({ name: 'Reset Customer', email, password }).expect(201);
  await request(emailApp).post('/api/auth/forgot-password').send({ email: 'unknown@zestora.example', language: 'en' }).expect(202);
  await request(emailApp).post('/api/auth/forgot-password').send({ email, language: 'en' }).expect(202);
  await vi.waitFor(() => expect(messages).toHaveLength(1));
  const resetUrl = new URL(messages[0].text.split('\n').at(-1) ?? '');
  const key = new URLSearchParams(resetUrl.hash.slice(1)).get('key');
  expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const nextPassword = randomBytes(18).toString('base64url');
  await request(emailApp).post('/api/auth/reset-password').send({ key, password: nextPassword }).expect(204);
  await client.get('/api/auth/me').expect(401);
  await request(emailApp).post('/api/auth/reset-password').send({ key, password: nextPassword }).expect(400);
  await client.post('/api/auth/login').send({ email, password: nextPassword }).expect(200);
});

describe('administration', () => {
  const adminApp = createApp(config);
  const manager = request.agent(adminApp);
  const visitor = request.agent(adminApp);

  beforeAll(async () => {
    await manager.post('/api/auth/login').send({ email: demoEmail, password }).expect(200);
    await visitor.post('/api/auth/login').send({ email: buyer.email, password }).expect(200);
  });

  test('catalogue changes require an administrator and update the public API', async () => {
    const name = { en: 'Lab Samples', si: 'ආදර්ශ එකතුව' };
    const category = { slug: 'lab-samples', name, position: 2, published: true };
    await visitor.post('/api/admin/categories').send(category).expect(403);
    await manager.post('/api/admin/categories').send(category).expect(201);
    await manager.post('/api/admin/categories').send(category).expect(409);
    const product = {
      slug: 'lab-juice', name, category: category.slug, description: name, ingredients: [name], image: '/images/mango.webp',
      sizes: [{ id: 'regular', name, price: 350 }], addOns: [], published: true, available: true,
    };
    await manager.post('/api/admin/products').send(product).expect(201);
    await request(app).get('/api/products/lab-juice').expect(200);
    await manager.put('/api/admin/products/lab-juice').send({ ...product, sizes: [{ ...product.sizes[0], price: 375 }] }).expect(200);
    const publicProduct = await request(app).get('/api/products/lab-juice').expect(200);
    expect(publicProduct.body.item.startingPrice).toBe(375);
    await manager.delete('/api/admin/products/lab-juice').expect(204);
    await request(app).get('/api/products/lab-juice').expect(404);
    await manager.delete('/api/admin/categories/lab-samples').expect(204);
  });

  test('permitted order transitions and cash payments feed actual reports and audit records', async () => {
    const listed = await manager.get('/api/admin/orders?q=Demo%20Buyer&status=pending').expect(200);
    const ref = listed.body.items.find((item: { fulfillment: { type: string } }) => item.fulfillment.type === 'pickup').reference;
    await manager.patch('/api/admin/orders/' + ref + '/status').send({ status: 'completed' }).expect(409);
    await manager.patch('/api/admin/orders/' + ref + '/status').send({ status: 'confirmed' }).expect(200);
    await manager.patch('/api/admin/orders/' + ref + '/status').send({ status: 'preparing' }).expect(200);
    await manager.patch('/api/admin/orders/' + ref + '/status').send({ status: 'out_for_delivery' }).expect(409);
    await manager.patch('/api/admin/orders/' + ref + '/status').send({ status: 'ready_for_pickup' }).expect(200);
    const paid = await manager.patch('/api/admin/orders/' + ref + '/cash-payment').expect(200);
    expect(paid.body.order.paymentStatus).toBe('paid');
    await manager.patch('/api/admin/orders/' + ref + '/cash-payment').expect(409);
    await manager.patch('/api/admin/orders/' + ref + '/status').send({ status: 'completed' }).expect(200);
    const snapshot = await manager.get('/api/admin/dashboard').expect(200);
    expect(snapshot.body.metrics).toMatchObject({ completed: 1, revenue: paid.body.order.totals.total });
    const report = await manager.get('/api/admin/reports?period=month').expect(200);
    expect(report.body.items[0]).toMatchObject({ paidOrders: 1, revenue: paid.body.order.totals.total });
    const audit = await manager.get('/api/admin/audit').expect(200);
    expect(audit.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'cash_paid', reference: ref })]));
  });

  test('stock, promotions, business settings, and customer history use MongoDB records', async () => {
    await manager.put('/api/admin/inventory/mango').send({ name: { en: 'Mango', si: 'අඹ' }, unit: 'kg', onHand: 3, threshold: 5 }).expect(200);
    const status = await manager.get('/api/admin/dashboard').expect(200);
    expect(status.body.lowStock.map((stock: { slug: string }) => stock.slug)).toContain('mango');
    const coupon = { type: 'fixed', value: 100, minimumOrder: 500, active: true, usageLimit: 2 };
    await manager.put('/api/admin/coupons/FIXED100').send(coupon).expect(200);
    const quote = await request(app).post('/api/orders/quote').send({ items: [mango], fulfillment: pickup, coupon: 'fixed100' }).expect(200);
    expect(quote.body.totals.discount).toBe(100);
    const { body: settings } = await manager.get('/api/admin/settings').expect(200);
    settings.presentation.name = 'Zestora Test Shop';
    settings.deliveryZones[0].fee = 250;
    await manager.put('/api/admin/settings').send(settings).expect(200);
    const business = await request(app).get('/api/shop/storefront').expect(200);
    expect(business.body.name).toBe('Zestora Test Shop');
    const checkout = await request(app).get('/api/shop/checkout').expect(200);
    expect(checkout.body.deliveryZones[0].fee).toBe(250);
    const clients = await manager.get('/api/admin/customers?q=buyer%40zestora.example').expect(200);
    const person = clients.body.items.find((user: { email: string }) => user.email === buyer.email);
    expect(person).not.toHaveProperty('passwordHash');
    const history = await manager.get('/api/admin/customers/' + person._id + '/orders').expect(200);
    expect(history.body.items.length).toBeGreaterThan(0);
  });

  test('image uploads are admin-only and normalized before provider upload', async () => {
    await manager.post('/api/admin/images').set('Content-Type', 'image/png').send(Buffer.from('invalid')).expect(503);
    const uploaded: Buffer[] = [];
    const images = createApp(config, undefined, async image => {
      uploaded.push(image);
      return 'https://res.cloudinary.com/demo/image/upload/zestora/test.webp';
    });
    const user = request.agent(images);
    await user.post('/api/auth/login').send({ email: demoEmail, password }).expect(200);
    await request(images).post('/api/admin/images').set('Content-Type', 'image/png').send(Buffer.from('invalid')).expect(401);
    await user.post('/api/admin/images').set('Content-Type', 'image/png').send(Buffer.from('invalid')).expect(400);
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#15512f' } }).png().toBuffer();
    const response = await user.post('/api/admin/images').set('Content-Type', 'image/png').send(png).expect(201);
    expect(response.body.url).toContain('/zestora/test.webp');
    expect((await sharp(uploaded[0]).metadata()).format).toBe('webp');
  });
});

describe('PayHere and notifications', () => {
  const onlineOrder = () => ({
    items: [{ ...mango, sizeId: 'regular', quantity: 1, addOnIds: [] }],
    fulfillment: pickup, customer: buyer, expectedTotal: 690, payment: 'payhere',
    billing: { address: 'Example billing address', city: 'Colombo' },
    checkoutKey: randomUUID(), guestKey: guestKey(),
  });

  test('the approved sandbox contract verifies callbacks and keeps retries idempotent', async () => {
    const merchant = '12345';
    const merchantSecret = randomBytes(24).toString('base64url');
    const sandbox = createApp(readConfig({
      NODE_ENV: 'test', PAYHERE_MODE: 'sandbox', PAYHERE_MERCHANT_ID: merchant, PAYHERE_MERCHANT_SECRET: merchantSecret,
      PAYHERE_NOTIFY_URL: 'https://callbacks.zestora.example/api/payments/payhere/notify',
    }));
    const body = onlineOrder();
    const creation = await request(sandbox).post('/api/orders').send(body).expect(201);
    const reference = creation.body.order.reference;
    expect(creation.body.order).toMatchObject({ paymentMethod: 'payhere', paymentEnvironment: 'sandbox', paymentStatus: 'pending' });
    expect(creation.body.order).not.toHaveProperty('billing');
    const access = { reference, key: body.guestKey };
    await request(sandbox).post('/api/payments/payhere/start').send({ reference, key: guestKey() }).expect(404);
    const start = await request(sandbox).post('/api/payments/payhere/start').send(access).expect(200);
    const digest = (value: string) => createHash('md5').update(value).digest('hex').toUpperCase();
    const expected = digest(merchant + reference + '690.00LKR' + digest(merchantSecret));
    expect(start.body).toMatchObject({
      action: 'https://sandbox.payhere.lk/pay/checkout',
      fields: { order_id: reference, amount: '690.00', currency: 'LKR', hash: expected },
    });
    expect(start.text).not.toContain(merchantSecret);
    const current = await request(sandbox).post('/api/payments/status').send(access).expect(200);
    expect(current.body.status).toBe('pending');

    function callback(code: string, amount = '690.00') {
      return {
        merchant_id: merchant, order_id: reference, payment_id: 'EXAMPLE-PAYHERE-1',
        payhere_amount: amount, payhere_currency: 'LKR', status_code: code,
        md5sig: digest(merchant + reference + amount + 'LKR' + code + digest(merchantSecret)),
      };
    }

    const sendCallback = (body: Record<string, string>) => request(sandbox).post('/api/payments/payhere/notify').type('form').send(body);
    await sendCallback({ ...callback('2'), md5sig: '0'.repeat(32) }).expect(403);
    await sendCallback(callback('2', '691.00')).expect(409);
    await sendCallback(callback('2')).expect(200);
    const settled = await Payment.findOne({ orderReference: reference });
    expect(settled?.status).toBe('paid');
    expect(settled?.paidAt).toBeDefined();
    await sendCallback(callback('2')).expect(200);
    await sendCallback(callback('0')).expect(200);
    await sendCallback(callback('-2')).expect(200);
    const repeated = await Payment.findOne({ orderReference: reference });
    expect(repeated?.paidAt).toEqual(settled?.paidAt);
    expect(repeated?.status).toBe('paid');
    await sendCallback(callback('-3')).expect(200);
    const refunded = await request(sandbox).post('/api/payments/status').send(access).expect(200);
    expect(refunded.body.status).toBe('refunded');
    expect(await Payment.countDocuments({ orderReference: reference })).toBe(1);
  });

  test('the simulator is isolated from production and requires order access', async () => {
    const simulator = createApp(readConfig({ NODE_ENV: 'test', PAYHERE_SIMULATOR: 'true' }));
    const production = createApp(readConfig({ NODE_ENV: 'production', PAYHERE_SIMULATOR: 'true' }));
    const body = onlineOrder();
    await request(production).post('/api/orders').send(body).expect(400);
    await request(production).post('/api/payments/simulate').send({}).expect(404);
    const created = await request(simulator).post('/api/orders').send(body).expect(201);
    const reference = created.body.order.reference;
    await request(simulator).post('/api/payments/simulate').send({ reference, key: guestKey(), outcome: 'paid' }).expect(404);
    const failed = await request(simulator).post('/api/payments/simulate').send({ reference, key: body.guestKey, outcome: 'failed' }).expect(200);
    expect(failed.body).toMatchObject({ environment: 'simulator', status: 'failed' });
    const paid = await request(simulator).post('/api/payments/simulate').send({ reference, key: body.guestKey, outcome: 'paid' }).expect(200);
    expect(paid.body).toMatchObject({ environment: 'simulator', status: 'paid' });
    const admin = request.agent(simulator);
    await admin.post('/api/auth/login').send({ email: demoEmail, password }).expect(200);
    const report = await admin.get('/api/admin/dashboard').expect(200);
    expect(report.body.metrics.revenue).toBe(1940);
  });

  test('order and status email jobs are deduplicated and mail failure preserves the order', async () => {
    const messages: Email[] = [];
    const mailApp = createApp(config, async message => {
      messages.push(message);
      if (messages.length === 1) throw new Error('Test mail delivery failure');
    });
    const body = { ...onlineOrder(), payment: 'cash', billing: undefined, language: 'si' };
    const created = await request(mailApp).post('/api/orders').send(body).expect(201);
    const reference = created.body.order.reference;
    await vi.waitFor(async () => expect((await Notification.findOne({ key: reference + ':created' }))?.status).toBe('failed'));
    await request(mailApp).post('/api/orders').send(body).expect(200);
    expect(messages).toHaveLength(1);
    const admin = request.agent(mailApp);
    await admin.post('/api/auth/login').send({ email: demoEmail, password }).expect(200);
    await admin.patch('/api/admin/orders/' + reference + '/status').send({ status: 'confirmed' }).expect(200);
    await vi.waitFor(async () => expect((await Notification.findOne({ key: reference + ':confirmed' }))?.status).toBe('sent'));
    expect(messages).toHaveLength(2);
    expect(messages[1].text).toContain(reference);
    expect(messages[1].subject).toMatch(/තහවුරු/);
  });
});
