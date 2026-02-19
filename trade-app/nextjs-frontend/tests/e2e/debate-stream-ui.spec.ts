import { test, expect } from '../support/fixtures';
import {
  injectWebSocketInterceptor,
  waitForWebSocketConnection,
  getWebSocketMessages,
} from '../support/helpers/ws-helpers';

test.describe('[1-5] Debate Stream UI (The Arena) E2E Tests', () => {
  test.describe('[P0] Critical Path', () => {
    test('[1-5-E2E-001] DebateStream renders with debate data @p0 @smoke', async ({ page }) => {
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

  test.describe('[P1] Active Waiting & Streaming', () => {
    test('[1-5-E2E-004] Typing indicator shows during TOKEN_RECEIVED @p1', async ({ page }) => {
      await injectWebSocketInterceptor(page);

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'DOGE');
      await page.fill('[data-testid="title-input"]', 'Dogecoin Analysis');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;
      await waitForWebSocketConnection(page);

      const typingIndicator = page.locator('[data-testid="typing-indicator"]');
      await expect(typingIndicator).toBeVisible({ timeout: 10000 });

      await expect(typingIndicator.getByText(/bull.*thinking|analyzing/i)).toBeVisible();
    });

    test('[1-5-E2E-005] Typing indicator hides on ARGUMENT_COMPLETE @p1', async ({ page }) => {
      await injectWebSocketInterceptor(page);

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'ADA');
      await page.fill('[data-testid="title-input"]', 'Cardano Analysis');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;
      await waitForWebSocketConnection(page);

      const typingIndicator = page.locator('[data-testid="typing-indicator"]');
      await expect(typingIndicator).toBeVisible({ timeout: 10000 });

      await page.waitForTimeout(10000);

      const messages = await getWebSocketMessages(page);
      const hasComplete = messages.some((m) => m.type === 'DEBATE/ARGUMENT_COMPLETE');

      if (hasComplete) {
        await expect(typingIndicator).not.toBeVisible({ timeout: 5000 });
      }
    });

    test('[1-5-E2E-006] Auto-scroll brings new messages into view @p1', async ({ page }) => {
      await injectWebSocketInterceptor(page);

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'DOT');
      await page.fill('[data-testid="title-input"]', 'Polkadot Analysis');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;
      await waitForWebSocketConnection(page);

      await page.waitForTimeout(8000);

      const debateStream = page.locator('[data-testid="debate-stream"]');
      const isScrolledToBottom = await debateStream.evaluate((el) => {
        const threshold = 100;
        return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      });

      expect(isScrolledToBottom).toBe(true);
    });

    test('[1-5-E2E-007] User scroll detection pauses auto-scroll @p1', async ({ page }) => {
      await injectWebSocketInterceptor(page);

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'AVAX');
      await page.fill('[data-testid="title-input"]', 'Avalanche Analysis');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;
      await waitForWebSocketConnection(page);

      const debateStream = page.locator('[data-testid="debate-stream"]');
      await expect(debateStream).toBeVisible({ timeout: 10000 });

      await debateStream.evaluate((el) => {
        el.scrollTop = 0;
      });

      await page.waitForTimeout(3000);

      const scrollTop = await debateStream.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBe(0);
    });
  });

  test.describe('[P1] Mobile & Accessibility', () => {
    test('[1-5-E2E-008] Mobile portrait layout is readable @p1', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await injectWebSocketInterceptor(page);

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'LINK');
      await page.fill('[data-testid="title-input"]', 'Chainlink Analysis');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;

      const debateStream = page.locator('[data-testid="debate-stream"]');
      await expect(debateStream).toBeVisible({ timeout: 30000 });

      const argumentText = debateStream.locator('p').first();
      const fontSize = await argumentText.evaluate((el) =>
        window.getComputedStyle(el).fontSize
      );
      const fontSizeNum = parseFloat(fontSize);
      expect(fontSizeNum).toBeGreaterThanOrEqual(16);

      const boundingBox = await debateStream.boundingBox();
      expect(boundingBox?.width).toBeLessThanOrEqual(375);
    });

    test('[1-5-E2E-009] WCAG AA accessibility passes @p1 @accessibility', async ({ page }) => {
      await injectWebSocketInterceptor(page);

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'MATIC');
      await page.fill('[data-testid="title-input"]', 'Polygon Analysis');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;

      const liveRegion = page.locator('[role="log"][aria-live="polite"]');
      await expect(liveRegion).toBeVisible({ timeout: 30000 });

      const debateStream = page.locator('[data-testid="debate-stream"]');
      await expect(debateStream).toHaveAttribute('aria-label', /debate messages/i);
    });

    test('[1-5-E2E-010] Dual-coding for color (icons + text) @p1 @accessibility', async ({ page }) => {
      await injectWebSocketInterceptor(page);

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'UNI');
      await page.fill('[data-testid="title-input"]', 'Uniswap Analysis');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;
      await waitForWebSocketConnection(page);
      await page.waitForTimeout(5000);

      const bullSection = page.locator('[data-agent="bull"]').first();
      const bullIcon = bullSection.locator('svg, [data-testid="bull-icon"]');
      await expect(bullIcon).toBeVisible({ timeout: 30000 });
      await expect(bullSection.getByText(/bull|bullish/i)).toBeVisible();

      const bearSection = page.locator('[data-agent="bear"]').first();
      const bearIcon = bearSection.locator('svg, [data-testid="bear-icon"]');
      await expect(bearIcon).toBeVisible({ timeout: 30000 });
      await expect(bearSection.getByText(/bear|bearish/i)).toBeVisible();
    });
  });

  test.describe('[P2] UX Polish', () => {
    test('[1-5-E2E-012] Thumb Zone compliance on mobile @p2', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await injectWebSocketInterceptor(page);

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'ATOM');
      await page.fill('[data-testid="title-input"]', 'Cosmos Analysis');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;

      const debateStream = page.locator('[data-testid="debate-stream"]');
      const boundingBox = await debateStream.boundingBox();

      if (boundingBox) {
        const thumbZoneStart = 667 * 0.7;
        expect(boundingBox.y + boundingBox.height).toBeLessThanOrEqual(thumbZoneStart + 50);
      }
    });

    test('[1-5-E2E-013] ARIA live region announces new messages @p2 @accessibility', async ({
      page,
    }) => {
      await injectWebSocketInterceptor(page);

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'LTC');
      await page.fill('[data-testid="title-input"]', 'Litecoin Analysis');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;
      await waitForWebSocketConnection(page);

      const liveRegion = page.locator('[aria-live="polite"]');
      await expect(liveRegion).toBeVisible({ timeout: 30000 });

      await page.waitForTimeout(8000);

      const liveContent = await liveRegion.textContent();
      expect(liveContent?.length).toBeGreaterThan(0);
    });

    test('[1-5-E2E-014] Motion safety respects prefers-reduced-motion @p2 @accessibility', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await injectWebSocketInterceptor(page);

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'XLM');
      await page.fill('[data-testid="title-input"]', 'Stellar Analysis');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;

      const animatedElements = page.locator('[data-testid="typing-indicator"], [class*="animate"]');
      const count = await animatedElements.count();

      for (let i = 0; i < count; i++) {
        const el = animatedElements.nth(i);
        const animation = await el.evaluate((elem) =>
          window.getComputedStyle(elem).animation
        );
        expect(animation).toBe('none 0s ease 0s normal none running none');
      }
    });

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
  });

  test.describe('[P3] Edge Cases', () => {
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
});
