import { test, expect } from '../support/fixtures';
import {
  injectWebSocketInterceptor,
  waitForWebSocketConnection,
} from '../support/helpers/ws-helpers';
import { setupApiMocks } from '../support/helpers/api-mock';

test.describe('[1-5] Debate Stream UI — Critical Path (P0)', () => {
  test('[1-5-E2E-001] DebateStream renders with debate data @p0 @smoke', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    const debateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
    );

    await page.goto('/');
    await page.click('[data-testid="create-debate-btn"]');
    await page.fill('[data-testid="ticker-input"]', 'BTC');
    await page.fill('[data-testid="title-input"]', 'Bitcoin Analysis');
    await page.click('[data-testid="submit-debate-btn"]');

    await debateResponse;
    await expect(page).toHaveURL(/.*debates\/.+/);

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 30000 });

    await expect(page.getByRole('log', { name: /debate messages/i })).toBeVisible();
  });

  test('[1-5-E2E-002] Bull arguments display with emerald styling on left @p0', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    const debateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
    );

    await page.goto('/');
    await page.click('[data-testid="create-debate-btn"]');
    await page.fill('[data-testid="ticker-input"]', 'ETH');
    await page.fill('[data-testid="title-input"]', 'Ethereum Analysis');
    await page.click('[data-testid="submit-debate-btn"]');

    await debateResponse;
    await waitForWebSocketConnection(page);

    await page.waitForTimeout(5000);

    const bullArgument = page.locator('[data-testid="bull-arguments"]').first();
    await expect(bullArgument).toBeVisible({ timeout: 30000 });

    const bullBubble = bullArgument.locator('[data-agent="bull"]').first();
    await expect(bullBubble).toBeVisible();

    await expect(bullBubble).toHaveCSS('justify-content', /flex-start|left/);

    const bullIndicator = bullBubble.locator('[data-testid="bull-icon"]');
    await expect(bullIndicator).toBeVisible();

    await expect(bullBubble.getByText(/bull/i)).toBeVisible();
  });

  test('[1-5-E2E-003] Bear arguments display with rose styling on right @p0', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    const debateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
    );

    await page.goto('/');
    await page.click('[data-testid="create-debate-btn"]');
    await page.fill('[data-testid="ticker-input"]', 'SOL');
    await page.fill('[data-testid="title-input"]', 'Solana Analysis');
    await page.click('[data-testid="submit-debate-btn"]');

    await debateResponse;
    await waitForWebSocketConnection(page);

    await page.waitForTimeout(5000);

    const bearArgument = page.locator('[data-testid="bear-arguments"]').first();
    await expect(bearArgument).toBeVisible({ timeout: 30000 });

    const bearBubble = bearArgument.locator('[data-agent="bear"]').first();
    await expect(bearBubble).toBeVisible();

    await expect(bearBubble).toHaveCSS('justify-content', /flex-end|right/);

    const bearIndicator = bearBubble.locator('[data-testid="bear-icon"]');
    await expect(bearIndicator).toBeVisible();

    await expect(bearBubble.getByText(/bear/i)).toBeVisible();
  });

  test('[1-5-E2E-011] Virtualization handles 1000 messages @p0 @performance', async ({ page }) => {
    await injectWebSocketInterceptor(page);

    await page.route('**/api/debate/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'test-debate-1000',
            asset: 'btc',
            status: 'completed',
            messages: Array.from({ length: 1000 }, (_, i) => ({
              id: `msg-${i}`,
              role: i % 2 === 0 ? 'bull' : 'bear',
              content: `Message ${i}: This is a test argument with some content to make it realistic.`,
              timestamp: new Date().toISOString(),
            })),
          },
        }),
      });
    });

    const startTime = Date.now();

    await page.goto('/debates/test-debate-1000');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 30000 });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000);

    const renderedMessages = await debateStream.locator('[data-testid^="argument-"]').count();
    expect(renderedMessages).toBeGreaterThan(0);
    expect(renderedMessages).toBeLessThan(100);
  });
});
