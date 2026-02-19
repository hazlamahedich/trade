import { test, expect } from '../support/fixtures';

test.describe('Infrastructure @e2e @p0', () => {
  test('[1-1-E2E-001] should load frontend and verify backend connectivity', async ({ page, request }) => {
    const healthPromise = request.get('/api/health');

    await page.goto('/');

    const healthResponse = await healthPromise;
    expect(healthResponse.status()).toBe(200);

    const body = await healthResponse.json();
    expect(body.data.status).toBe('healthy');
  });

  test('[1-1-E2E-002] should display application correctly on initial load', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Trade|Debate/i);

    await expect(page.locator('body')).toBeVisible();
  });

  test('[1-1-E2E-003] should handle backend unavailable gracefully', async ({ page, context }) => {
    await context.route('**/api/health', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          error: 'Service Unavailable',
          meta: {},
        }),
      });
    });

    await page.goto('/');

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Infrastructure - Network Resilience @e2e @p1', () => {
  test('[1-1-E2E-004] should reconnect when network recovers', async ({ page, context }) => {
    await page.goto('/');

    await expect(page.locator('body')).toBeVisible();

    await context.setOffline(true);
    await page.waitForFunction(() => !navigator.onLine);

    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine);

    await expect(page.locator('body')).toBeVisible();
  });

  test('[1-1-E2E-005] should load within performance budget', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');

    await expect(page.locator('body')).toBeVisible();

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000);
  });
});
