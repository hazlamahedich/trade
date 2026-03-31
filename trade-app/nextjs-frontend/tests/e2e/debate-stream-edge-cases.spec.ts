import { test, expect } from '../support/fixtures';
import {
  injectWebSocketInterceptor,
  waitForWebSocketConnection,
} from '../support/helpers/ws-helpers';

test.describe('[1-5] Debate Stream UI — Edge Cases (P2/P3)', () => {
  test('[1-5-E2E-015] WebSocket reconnection UI feedback @p2', async ({ page }) => {
    await injectWebSocketInterceptor(page);

    const debateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
    );

    await page.goto('/');
    await page.click('[data-testid="create-debate-btn"]');
    await page.fill('[data-testid="ticker-input"]', 'ALGO');
    await page.fill('[data-testid="title-input"]', 'Algorand Analysis');
    await page.click('[data-testid="submit-debate-btn"]');

    await debateResponse;
    await waitForWebSocketConnection(page);

    await page.evaluate(() => {
      const ws = (window as Window & { __testWebSocket__?: WebSocket }).__testWebSocket__;
      if (ws) {
        ws.close(1006, 'Simulated disconnect');
      }
    });

    const connectionStatus = page.locator('[data-testid="ws-connection-status"]');
    await expect(connectionStatus).toBeVisible({ timeout: 5000 });

    const status = await connectionStatus.getAttribute('data-status');
    expect(['connecting', 'disconnected', 'reconnecting']).toContain(status);
  });

  test('[1-5-E2E-016] Empty state shows when no messages @p3', async ({ page }) => {
    await page.route('**/api/debate/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'empty-debate',
            asset: 'btc',
            status: 'pending',
            messages: [],
          },
        }),
      });
    });

    await page.goto('/debates/empty-debate');

    const emptyState = page.locator('[data-testid="debate-stream-empty"]');
    await expect(emptyState).toBeVisible({ timeout: 10000 });
    await expect(emptyState.getByText(/waiting.*debate|no messages/i)).toBeVisible();
  });

  test('[1-5-E2E-017] Very long message handling @p3', async ({ page }) => {
    const longMessage = 'A'.repeat(10000);

    await page.route('**/api/debate/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'long-message-debate',
            asset: 'btc',
            status: 'completed',
            messages: [
              {
                id: 'msg-1',
                role: 'bull',
                content: longMessage,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        }),
      });
    });

    await page.goto('/debates/long-message-debate');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 10000 });

    const argumentBubble = debateStream.locator('[data-testid^="argument-"]').first();
    await expect(argumentBubble).toBeVisible();

    const isScrollable = await argumentBubble.evaluate((el) => {
      return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
    });
    expect(isScrollable).toBe(true);
  });
});
