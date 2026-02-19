import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const envConfigMap = {
  local: {
    baseURL: 'http://localhost:3000',
    apiURL: 'http://localhost:8000',
    wsURL: 'ws://localhost:8000/ws',
  },
  staging: {
    baseURL: process.env.STAGING_BASE_URL || 'https://staging.trade-app.vercel.app',
    apiURL: process.env.STAGING_API_URL || 'https://api-staging.trade-app.railway.app',
    wsURL: process.env.STAGING_WS_URL || 'wss://api-staging.trade-app.railway.app/ws',
  },
  production: {
    baseURL: process.env.PROD_BASE_URL || 'https://trade-app.vercel.app',
    apiURL: process.env.PROD_API_URL || 'https://api.trade-app.railway.app',
    wsURL: process.env.PROD_WS_URL || 'wss://api.trade-app.railway.app/ws',
  },
};

const environment = (process.env.TEST_ENV || 'local') as keyof typeof envConfigMap;

if (!envConfigMap[environment]) {
  console.error(`No configuration found for environment: ${environment}`);
  console.error(`Available environments: ${Object.keys(envConfigMap).join(', ')}`);
  process.exit(1);
}

console.log(`Running tests against: ${environment.toUpperCase()}`);

const envConfig = envConfigMap[environment];

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['list'],
  ],
  use: {
    actionTimeout: 15000,
    navigationTimeout: 30000,
    baseURL: envConfig.baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  globalSetup: path.resolve(__dirname, './tests/support/global-setup.ts'),
  projects: [
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      dependencies: ['setup'],
    },
  ],
  webServer: environment === 'local' ? {
    command: 'pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  } : undefined,
});
