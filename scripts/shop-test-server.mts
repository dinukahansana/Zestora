import { execFile } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { promisify } from 'node:util';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { createServer } from 'vite';
import { User } from '../apps/api/src/auth/models.ts';
import { hashPassword } from '../apps/api/src/auth/passwords.ts';
import { createApp } from '../apps/api/src/app.ts';
import { readConfig } from '../apps/api/src/config.ts';
import { connectDatabase, disconnectDatabase } from '../apps/api/src/database.ts';

const port = 4176;
const host = '127.0.0.1';
const origin = `http://${host}:${port}`;
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const uri = mongo.getUri('zestora_shop_test');
const seed = promisify(execFile);
await seed(process.execPath, ['scripts/seed-demo.mts'], { env: { ...process.env, MONGODB_URI: uri } });
await connectDatabase(uri);
const adminPassword = process.env.ZESTORA_TEST_ADMIN_PASSWORD;
if (adminPassword) await User.create({ name: 'Browser Owner', email: 'browser-owner@zestora.example', passwordHash: await hashPassword(adminPassword), role: 'admin' });
const api = createApp(readConfig({ NODE_ENV: 'test', ALLOWED_ORIGINS: origin, PAYHERE_SIMULATOR: 'true' })).listen(0, host);
await once(api, 'listening');
const address = api.address();
if (!address || typeof address === 'string') throw new Error('Could not start the test API.');
process.env.API_PROXY_TARGET = `http://${host}:${address.port}`;
process.env.VITE_CATALOGUE_MODE = 'api';
const vite = await createServer({ root: path.resolve('apps/web'), server: { host, port, strictPort: true } });
await vite.listen();
console.log(`Test storefront listening on ${origin}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await vite.close();
    await new Promise<void>(resolve => api.close(() => resolve()));
    await disconnectDatabase();
    await mongo.stop();
    process.exit(0);
  });
}
