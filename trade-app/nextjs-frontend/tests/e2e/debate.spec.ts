import { test, expect } from '../support/fixtures';

test.describe('Debate Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the debate list page', async ({ page }) => {
    await expect(page).toHaveTitle(/AI Trading Debate Lab/);
    await expect(page.getByTestId('debate-list')).toBeVisible();
  });

  test('should navigate to create debate page', async ({ page }) => {
    await page.click('[data-testid="create-debate-btn"]');
    await expect(page).toHaveURL(/.*create/);
    await expect(page.getByTestId('create-debate-form')).toBeVisible();
  });

  test('should create a new debate with valid data', async ({ page }) => {
    await page.click('[data-testid="create-debate-btn"]');
    
    await page.fill('[data-testid="ticker-input"]', 'BTC');
    await page.fill('[data-testid="title-input"]', 'Bitcoin Price Analysis');
    
    await page.click('[data-testid="submit-debate-btn"]');
    
    await expect(page).toHaveURL(/.*debates\/.+/);
    await expect(page.getByTestId('debate-stream')).toBeVisible();
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    await page.click('[data-testid="create-debate-btn"]');
    
    await page.click('[data-testid="submit-debate-btn"]');
    
    await expect(page.getByTestId('ticker-error')).toBeVisible();
    await expect(page.getByTestId('title-error')).toBeVisible();
  });
});

test.describe('Debate Streaming', () => {
  test('should display streaming arguments in real-time', async ({ page }) => {
    await page.goto('/debates/test-debate-id');
    
    await expect(page.getByTestId('debate-stream')).toBeVisible();
    
    await expect(page.getByTestId('bull-arguments')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('bear-arguments')).toBeVisible({ timeout: 30000 });
  });

  test('should show risk guardian warnings', async ({ page }) => {
    await page.goto('/debates/test-debate-id');
    
    await expect(page.getByTestId('guardian-panel')).toBeVisible();
    await expect(page.getByTestId('risk-indicator')).toBeVisible();
  });
});
