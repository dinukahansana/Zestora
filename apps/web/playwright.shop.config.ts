import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

process.env.ZESTORA_TEST_ADMIN_PASSWORD ??= randomBytes(18).toString('base64url');
const baseURL = 'http://127.0.0.1:' + (process.env.ZESTORA_SHOP_TEST_PORT ?? '4176');

export default defineConfig({
  testDir: './tests/shop',
  outputDir: './test-results/shop',
  use: {
    baseURL,
    viewport: { width: 1360, height: 900 },
    locale: 'en-LK',
    reducedMotion: 'reduce',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/shop-test-server.mts',
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    url: baseURL,
    timeout: 180000,
  },
});
