import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4175';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    locale: 'en-LK',
    reducedMotion: 'reduce',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 4175',
    url: baseURL,
    env: {
      VITE_CATALOGUE_MODE: 'demo',
      VITE_BUSINESS_EMAIL: 'hello@zestora.example',
      VITE_BUSINESS_MAP_URL: 'https://www.google.com/maps/search/?api=1&query=Colombo',
    },
  },
});
