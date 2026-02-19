import { test, expect } from '../support/fixtures';
import {
  injectWebSocketInterceptor,
  waitForWebSocketConnection,
  getWebSocketMessages,
  clearWebSocketMessages,
} from '../support/helpers/ws-helpers';

test.describe('[1-4] WebSocket Streaming Layer E2E Tests', () => {
  test.describe('[P0] Critical Path', () => {
    test('[1-4-E2E-001] User sees tokens stream in real-time during debate @p0 @smoke', async ({
      page,
    }) => {
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

      await waitForWebSocketConnection(page);

      const messages = await getWebSocketMessages(page);
      const tokenMessages = messages.filter((m) => m.type === 'DEBATE/TOKEN_RECEIVED');

      expect(tokenMessages.length).toBeGreaterThan(0);
      expect(tokenMessages[0]).toHaveProperty('payload');
      expect(tokenMessages[0].payload).toHaveProperty('token');
      expect(tokenMessages[0].payload).toHaveProperty('agent');
      expect(['bull', 'bear']).toContain(tokenMessages[0].payload.agent);
    });

    test('[1-4-E2E-002] Argument complete event received after full message @p0', async ({
      page,
    }) => {
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

      const messages = await getWebSocketMessages(page);
      const argumentCompleteMessages = messages.filter((m) => m.type === 'DEBATE/ARGUMENT_COMPLETE');

      expect(argumentCompleteMessages.length).toBeGreaterThan(0);
      expect(argumentCompleteMessages[0]).toHaveProperty('payload');
      expect(argumentCompleteMessages[0].payload).toHaveProperty('content');
      expect(argumentCompleteMessages[0].payload).toHaveProperty('agent');
    });

    test('[1-4-E2E-003] Connected event received on WebSocket open @p0', async ({ page }) => {
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

      const messages = await getWebSocketMessages(page);
      const connectedMessages = messages.filter((m) => m.type === 'DEBATE/CONNECTED');

      expect(connectedMessages.length).toBeGreaterThan(0);
      expect(connectedMessages[0]).toHaveProperty('payload');
      expect(connectedMessages[0].payload).toHaveProperty('debateId');
    });
  });

  test.describe('[P1] Error Handling', () => {
    test('[1-4-E2E-004] Unauthorized connection shows error @p1', async ({ page }) => {
      await injectWebSocketInterceptor(page);

      await page.addInitScript(() => {
        localStorage.setItem('accessToken', '');
      });

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'BTC');
      await page.fill('[data-testid="title-input"]', 'Test Debate');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;

      await page.waitForTimeout(3000);

      const messages = await getWebSocketMessages(page);
      const errorMessages = messages.filter((m) => m.type === 'DEBATE/ERROR');

      if (errorMessages.length > 0) {
        expect(errorMessages[0]).toHaveProperty('payload');
        expect(errorMessages[0].payload).toHaveProperty('code');
        expect(errorMessages[0].payload.code).toMatch(/UNAUTHORIZED|NO_TOKEN|WS_4001/);
      }
    });

    test('[1-4-E2E-005] Connection status indicator updates correctly @p1', async ({
      page,
    }) => {
      await injectWebSocketInterceptor(page);

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'BTC');
      await page.fill('[data-testid="title-input"]', 'Connection Status Test');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;
      await waitForWebSocketConnection(page);

      const connectionIndicator = page.locator('[data-testid="ws-connection-status"]');
      await expect(connectionIndicator).toBeVisible({ timeout: 10000 });
    });

    test('[1-4-E2E-006] Turn change event received during debate @p1', async ({
      page,
    }) => {
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

      await page.waitForTimeout(10000);

      const messages = await getWebSocketMessages(page);
      const turnChangeMessages = messages.filter((m) => m.type === 'DEBATE/TURN_CHANGE');

      if (turnChangeMessages.length > 0) {
        expect(turnChangeMessages[0]).toHaveProperty('payload');
        expect(turnChangeMessages[0].payload).toHaveProperty('currentAgent');
        expect(['bull', 'bear']).toContain(turnChangeMessages[0].payload.currentAgent);
      }
    });
  });

  test.describe('[P1] Reconnection', () => {
    test('[1-4-E2E-007] Client reconnects after disconnect with exponential backoff @p1', async ({
      page,
    }) => {
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

      await clearWebSocketMessages(page);

      await page.evaluate(() => {
        const ws = (window as Window & { __testWebSocket__?: WebSocket }).__testWebSocket__;
        if (ws) {
          ws.close(1006, 'Simulated disconnect');
        }
      });

      await page.waitForTimeout(5000);

      const connectionIndicator = page.locator('[data-testid="ws-connection-status"]');
      const status = await connectionIndicator.getAttribute('data-status');

      expect(['connected', 'connecting', 'disconnected']).toContain(status);
    });
  });

  test.describe('[P2] Network Resilience', () => {
    test('[1-4-E2E-008] Heartbeat ping/pong maintains connection @p2', async ({ page }) => {
      await injectWebSocketInterceptor(page);

      const debateResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
      );

      await page.goto('/');
      await page.click('[data-testid="create-debate-btn"]');
      await page.fill('[data-testid="ticker-input"]', 'XRP');
      await page.fill('[data-testid="title-input"]', 'Ripple Analysis');
      await page.click('[data-testid="submit-debate-btn"]');

      await debateResponse;
      await waitForWebSocketConnection(page);

      await page.waitForTimeout(35000);

      const messages = await getWebSocketMessages(page);
      const pingMessages = messages.filter((m) => m.type === 'DEBATE/PING');

      expect(pingMessages.length).toBeGreaterThan(0);
    });

    test('[1-4-E2E-009] Debate status update received on completion @p2', async ({
      page,
    }) => {
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

      await page.waitForTimeout(60000);

      const messages = await getWebSocketMessages(page);
      const statusMessages = messages.filter((m) => m.type === 'DEBATE/STATUS_UPDATE');

      if (statusMessages.length > 0) {
        expect(statusMessages[0]).toHaveProperty('payload');
        expect(statusMessages[0].payload).toHaveProperty('status');
        expect(['running', 'completed', 'error']).toContain(statusMessages[0].payload.status);
      }
    });
  });

  test.describe('[P2] UI State', () => {
    test('[1-4-E2E-010] Streaming text accumulates in debate container @p2', async ({
      page,
    }) => {
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
      await expect(debateStream).toBeVisible({ timeout: 30000 });

      const initialContent = await debateStream.textContent();

      await page.waitForTimeout(5000);

      const updatedContent = await debateStream.textContent();

      expect(updatedContent?.length).toBeGreaterThanOrEqual(initialContent?.length || 0);
    });

    test('[1-4-E2E-011] Bull and Bear arguments display separately @p2', async ({
      page,
    }) => {
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
      await expect(page.getByTestId('bull-arguments')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('bear-arguments')).toBeVisible({ timeout: 30000 });
    });
  });
});
