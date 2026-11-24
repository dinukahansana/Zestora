import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';

const run = promisify(execFile);
const root = new URL('../', import.meta.url);
const scratch = await mkdtemp(join(tmpdir(), 'zestora-production-'));
const key = join(scratch, 'key.pem');
const cert = join(scratch, 'cert.pem');
const openssl = process.env.ZESTORA_OPENSSL_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl');
const password = randomBytes(20).toString('base64url');
const ownerEmail = 'production-test@zestora.example';
const { createApp } = await import('../apps/api/dist/app.js');
const { readConfig } = await import('../apps/api/dist/config.js');
const { connectDatabase, disconnectDatabase } = await import('../apps/api/dist/database.js');

let database, api, edge, browser;
const close = (server?: { close: (callback: () => void) => unknown }) => server ? new Promise<void>(resolve => server.close(resolve)) : undefined;

try {
  await run(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', key, '-out', cert]);
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = database.getUri('zestora_production_test');
  const env = { ...process.env, MONGODB_URI: uri, ADMIN_NAME: 'Production Test', ADMIN_EMAIL: ownerEmail, ADMIN_PASSWORD: password };
  await run(process.execPath, ['scripts/seed-demo.mts'], { cwd: root, env });
  await run(process.execPath, ['scripts/create-admin.mts'], { cwd: root, env });
  await connectDatabase(uri);

  edge = createServer({ key: await readFile(key), cert: await readFile(cert) }, (incoming, outgoing) => {
    const address = api?.address();
    if (!address || typeof address === 'string') { outgoing.writeHead(503).end(); return; }
    const upstream = request({
      hostname: '127.0.0.1', port: address.port, method: incoming.method, path: incoming.url,
      headers: { ...incoming.headers, 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': incoming.socket.remoteAddress },
    }, result => {
      outgoing.writeHead(result.statusCode ?? 502, result.headers);
      result.pipe(outgoing);
    });
    upstream.on('error', () => outgoing.end());
    incoming.pipe(upstream);
  });
  edge.listen(0, '127.0.0.1');
  await once(edge, 'listening');
  const address = edge.address();
  assert(address && typeof address !== 'string');
  const origin = 'https://127.0.0.1:' + address.port;
  assert.throws(() => readConfig({ NODE_ENV: 'production', SERVE_WEB: 'true', SITE_ORIGIN: origin }), /requires MONGODB_URI/);
  const config = readConfig({
    NODE_ENV: 'production', TRUST_PROXY_HOPS: '1', SERVE_WEB: 'true', MONGODB_URI: uri,
    SITE_ORIGIN: origin, PAYHERE_SIMULATOR: 'true',
  });
  api = createApp(config).listen(0, '127.0.0.1');
  await once(api, 'listening');
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_PATH });
  const session = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await session.newPage();
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /content security policy/i.test(message.text())) errors.push(message.text()); });

  const health = await session.request.get(origin + '/api/ready');
  assert.equal(health.status(), 200);
  const bad = await session.request.get(origin + '/api/does-not-exist');
  assert.equal(bad.status(), 404);
  assert.match(bad.headers()['content-type'], /^application\/json/);
  assert.equal((await session.request.get(origin + '/assets/does-not-exist.js')).status(), 404);
  assert.equal((await session.request.get(origin + '/api/shop/checkout')).ok(), true);
  await session.request.post(origin + '/api/auth/login', {
    headers: { Origin: 'https://untrusted.example' }, data: { email: ownerEmail, password },
  }).then(response => assert.equal(response.status(), 403));

  const started = performance.now();
  const home = await page.goto(origin, { waitUntil: 'load' });
  assert.equal(home?.status(), 200);
  assert.equal(home?.headers()['cache-control'], 'no-cache');
  assert.match(home?.headers()['content-security-policy'] ?? '', /form-action 'self' https:\/\/sandbox\.payhere\.lk https:\/\/www\.payhere\.lk/);
  await page.locator('h1').waitFor();
  const loadMs = Math.round(performance.now() - started);
  const asset = await page.locator('script[type="module"]').getAttribute('src');
  assert(asset);
  const js = await session.request.get(new URL(asset, origin).href);
  assert.equal(js.status(), 200);
  assert.match(js.headers()['cache-control'], /max-age=31536000, immutable/);
  assert.equal((await session.request.get(origin + '/images/hero.webp')).status(), 200);
  for (const [route, heading] of [['/menu', 'The menu'], ['/menu/golden-mango', 'Golden Mango'], ['/assistant', 'Menu assistant'], ['/recommendations', 'Find a drink']]) {
    assert.equal((await page.goto(origin + route))?.status(), 200);
    await page.getByRole('heading', { name: heading }).first().waitFor();
    const viewport = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, width: innerWidth }));
    assert(viewport.content <= viewport.width, route + ' scrolls horizontally on mobile.');
  }
  const login = await session.request.post(origin + '/api/auth/login', { data: { email: ownerEmail, password }, headers: { Origin: origin } });
  assert.equal(login.status(), 200);
  const cookie = (await session.cookies()).find(item => item.name === '__Host-zestora-session');
  assert(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin + '/admin');
  await page.getByRole('heading', { name: 'Admin dashboard' }).waitFor();
  const checkout = await (await session.request.get(origin + '/api/shop/checkout')).json();
  assert(!checkout.paymentEnvironment, 'The payment simulator is active in production.');
  assert.deepEqual(errors, []);
  console.log('Production HTTPS, secure sessions, CSP, dynamic catalogue routes and mobile layouts passed. Local page load: ' + loadMs + ' ms.');
} finally {
  await browser?.close();
  await close(edge);
  await close(api);
  await disconnectDatabase();
  await database?.stop();
  await rm(scratch, { recursive: true });
}
