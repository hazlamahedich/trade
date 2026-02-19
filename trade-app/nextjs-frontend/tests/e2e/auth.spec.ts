import { test, expect } from '../support/fixtures';

test.describe('Authentication', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('email')).toBeVisible();
    await expect(page.getByTestId('password')).toBeVisible();
    await expect(page.getByTestId('login-button')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="email"]', 'invalid@example.com');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page.getByTestId('login-error')).toContainText(/invalid/i);
  });

  test('should redirect to dashboard on successful login', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword123';
    
    await page.goto('/login');
    
    await page.fill('[data-testid="email"]', email);
    await page.fill('[data-testid="password"]', password);
    await page.click('[data-testid="login-button"]');
    
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should persist authentication across page reload', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword123';
    
    await page.goto('/login');
    await page.fill('[data-testid="email"]', email);
    await page.fill('[data-testid="password"]', password);
    await page.click('[data-testid="login-button"]');
    
    await expect(page).toHaveURL(/.*dashboard/);
    
    await page.reload();
    
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByTestId('user-menu')).toBeVisible();
  });
});

test.describe('Authentication - Logout', () => {
  test.use({ storageState: './tests/.auth/user.json' });

  test('should logout successfully', async ({ page }) => {
    await page.goto('/dashboard');
    
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-btn"]');
    
    await expect(page).toHaveURL(/.*login/);
  });
});
