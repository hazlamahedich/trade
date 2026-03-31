import { test, expect } from '../support/fixtures';
import {
  injectWebSocketInterceptor,
  waitForWebSocketConnection,
  getWebSocketMessages,
} from '../support/helpers/ws-helpers';
import { setupApiMocks } from '../support/helpers/api-mock';

test.describe('[1-5] Debate Stream UI — Streaming (P1)', () => {
  test('[1-5-E2E-004] Typing indicator shows during TOKEN_RECEIVED @p1', async ({ page }) => {
    await setupApiMocks(page);
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
    await setupApiMocks(page);
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
    await setupApiMocks(page);
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
    await setupApiMocks(page);
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
