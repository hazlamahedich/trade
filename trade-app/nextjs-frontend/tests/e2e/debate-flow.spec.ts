import { test, expect } from '../support/fixtures';

/**
 * Story 1-3: Debate Engine Core (LangGraph) - E2E Tests
 *
 * Tests the complete debate creation and viewing flow from user perspective.
 * Uses network-first patterns for deterministic behavior.
 */
test.describe('[1-3] Debate Flow E2E Tests', () => {
  test.describe('[P0] Critical Path', () => {
    test('[1-3-E2E-001] User can create a new debate and see Bull/Bear arguments @p0', async ({ page }) => {
      const debateResponse = page.waitForResponse((resp) => 
        resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');

      await page.click('[data-testid="create-debate-btn"]');
      await expect(page).toHaveURL(/.*create/);

      await page.fill('[data-testid="ticker-input"]', 'BTC');
      await page.fill('[data-testid="title-input"]', 'Bitcoin Analysis');

      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;

      await expect(page).toHaveURL(/.*debates\/.+/);
      await expect(page.getByTestId('debate-stream')).toBeVisible({ timeout: 30000 });

      await expect(page.getByTestId('bull-arguments')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('bear-arguments')).toBeVisible({ timeout: 30000 });
    });

    test('[1-3-E2E-002] Debate displays correct asset information @p0', async ({ page }) => {
      const asset = 'ETH';

      const debateResponse = page.waitForResponse((resp) => 
        resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');

      await page.click('[data-testid="create-debate-btn"]');

      await page.fill('[data-testid="ticker-input"]', asset);
      await page.fill('[data-testid="title-input"]', 'Ethereum Price Analysis');

      await page.click('[data-testid="submit-debate-btn"]');

      const response = await debateResponse;
      const json = await response.json();

      expect(json.data.asset).toBe(asset.toLowerCase());
      expect(json.data.status).toBe('completed');

      await expect(page.getByText(new RegExp(asset, 'i'))).toBeVisible();
    });
  });

  test.describe('[P1] Error Handling', () => {
    test('[1-3-E2E-003] Stale market data shows user-friendly error message @p1', async ({ page }) => {
      await page.route('**/api/debate/start', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: {
              data: null,
              error: {
                code: 'STALE_MARKET_DATA',
                message: 'Market data is older than 60 seconds. Cannot start debate.',
              },
              meta: {},
            },
          }),
        });
      });

      await page.goto('/');

      await page.click('[data-testid="create-debate-btn"]');

      await page.fill('[data-testid="ticker-input"]', 'BTC');
      await page.fill('[data-testid="title-input"]', 'Test Debate');

      await page.click('[data-testid="submit-debate-btn"]');

      await expect(page.getByText(/stale|unavailable|try again/i)).toBeVisible({ timeout: 10000 });
    });

    test('[1-3-E2E-004] LLM provider error shows retry option @p1', async ({ page }) => {
      await page.route('**/api/debate/start', async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: {
              data: null,
              error: {
                code: 'LLM_PROVIDER_ERROR',
                message: 'LLM service temporarily unavailable',
              },
              meta: {},
            },
          }),
        });
      });

      await page.goto('/');

      await page.click('[data-testid="create-debate-btn"]');

      await page.fill('[data-testid="ticker-input"]', 'BTC');
      await page.fill('[data-testid="title-input"]', 'Test Debate');

      await page.click('[data-testid="submit-debate-btn"]');

      await expect(page.getByText(/unavailable|error|try again/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('[P2] Validation', () => {
    test('[1-3-E2E-005] Empty ticker shows validation error @p2', async ({ page }) => {
      await page.goto('/');

      await page.click('[data-testid="create-debate-btn"]');

      await page.fill('[data-testid="title-input"]', 'Test Debate');

      await page.click('[data-testid="submit-debate-btn"]');

      await expect(page.getByTestId('ticker-error')).toBeVisible();
    });

    test('[1-3-E2E-006] Empty title shows validation error @p2', async ({ page }) => {
      await page.goto('/');

      await page.click('[data-testid="create-debate-btn"]');

      await page.fill('[data-testid="ticker-input"]', 'BTC');

      await page.click('[data-testid="submit-debate-btn"]');

      await expect(page.getByTestId('title-error')).toBeVisible();
    });

    test('[1-3-E2E-007] Ticker too long shows validation error @p2', async ({ page }) => {
      await page.goto('/');

      await page.click('[data-testid="create-debate-btn"]');

      await page.fill('[data-testid="ticker-input"]', 'A'.repeat(21));
      await page.fill('[data-testid="title-input"]', 'Test Debate');

      await page.click('[data-testid="submit-debate-btn"]');

      await expect(page.getByTestId('ticker-error')).toBeVisible();
    });
  });

  test.describe('[P1] Network Resilience', () => {
    test('[1-3-E2E-008] Network error shows reconnection prompt @p1', async ({ page }) => {
      let requestCount = 0;

      await page.route('**/api/debate/start', async (route) => {
        requestCount++;
        if (requestCount === 1) {
          await route.abort('failed');
        } else {
          await route.continue();
        }
      });

      await page.goto('/');

      await page.click('[data-testid="create-debate-btn"]');

      await page.fill('[data-testid="ticker-input"]', 'BTC');
      await page.fill('[data-testid="title-input"]', 'Test Debate');

      await page.click('[data-testid="submit-debate-btn"]');

      await expect(page.getByText(/error|failed|try again/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('[P2] User Experience', () => {
    test('[1-3-E2E-009] Loading state shown during debate creation @p2', async ({ page }) => {
      await page.route('**/api/debate/start', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.continue();
      });

      await page.goto('/');

      await page.click('[data-testid="create-debate-btn"]');

      await page.fill('[data-testid="ticker-input"]', 'BTC');
      await page.fill('[data-testid="title-input"]', 'Test Debate');

      const submitPromise = page.click('[data-testid="submit-debate-btn"]');

      await expect(page.getByText(/loading|creating|processing/i)).toBeVisible({ timeout: 500 });

      await submitPromise;
    });

    test('[1-3-E2E-010] Arguments display in correct order (Bull first) @p2', async ({ page }) => {
      const debateResponse = page.waitForResponse((resp) => 
        resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');

      await page.click('[data-testid="create-debate-btn"]');

      await page.fill('[data-testid="ticker-input"]', 'BTC');
      await page.fill('[data-testid="title-input"]', 'Test Debate');

      await page.click('[data-testid="submit-debate-btn"]');

      const response = await debateResponse;
      const json = await response.json();

      expect(json.data.messages.length).toBeGreaterThan(0);

      const firstMessage = json.data.messages[0];
      expect(firstMessage.role).toBe('bull');
    });
  });
});
