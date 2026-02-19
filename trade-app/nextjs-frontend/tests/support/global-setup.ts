import { chromium } from '@playwright/test';
import path from 'path';

async function globalSetup() {
  const testEnv = process.env.TEST_ENV || 'local';
  
  console.log(`Global setup running for environment: ${testEnv}`);

  if (testEnv === 'local') {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const context = page.context();

    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (email && password) {
      try {
        await page.goto('http://localhost:3000/login');
        await page.fill('[data-testid="email"]', email);
        await page.fill('[data-testid="password"]', password);
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('**/dashboard', { timeout: 30000 });

        await context.storageState({
          path: path.resolve(__dirname, '../.auth/user.json'),
        });

        console.log('Auth state saved successfully');
      } catch (error) {
        console.warn('Failed to save auth state:', error);
      }
    }

    await browser.close();
  }

  console.log('Global setup complete');
}

export default globalSetup;
