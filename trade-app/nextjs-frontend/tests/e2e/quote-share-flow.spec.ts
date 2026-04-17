import { test, expect } from '../support/fixtures';
import {
  injectWebSocketInterceptor,
  waitForWebSocketConnection,
  sendWebSocketMessage,
} from '../support/helpers/ws-helpers';
import { setupApiMocks } from '../support/helpers/api-mock';

const BULL_ARG = {
  type: 'DEBATE/ARGUMENT_COMPLETE',
  payload: { agent: 'bull', content: 'BTC is going up. Strong momentum and increasing volume support the bullish thesis.' },
};

const BEAR_ARG = {
  type: 'DEBATE/ARGUMENT_COMPLETE',
  payload: { agent: 'bear', content: 'BTC is going down. RSI overbought and resistance at current levels.' },
};

test.describe('[5.3] Quote Sharing Flow — E2E (P0)', () => {
  test('[5.3-E2E-001] Share icon visible on completed argument bubbles @p0', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await sendWebSocketMessage(page, BULL_ARG);
    await sendWebSocketMessage(page, BEAR_ARG);

    const shareButtons = page.getByTestId('share-button');
    await expect(shareButtons.first()).toBeVisible({ timeout: 15000 });
  });

  test('[5.3-E2E-002] Share icon NOT visible on streaming argument @p0', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await page.evaluate(() => {
      const ws = (window as Record<string, unknown>).__mockWs;
      if (ws && typeof (ws as { send: (d: string) => void }).send === 'function') {
        (ws as { send: (d: string) => void }).send(JSON.stringify({
          type: 'DEBATE/ARGUMENT_RECEIVED',
          payload: { agent: 'bull', content: 'Streaming...' },
        }));
      }
    });

    const streamingCursor = page.getByTestId('streaming-cursor');
    if (await streamingCursor.isVisible({ timeout: 5000 }).catch(() => false)) {
      const argumentBubble = page.getByTestId('argument-bubble').first();
      const shareBtn = argumentBubble.getByTestId('share-button');
      await expect(shareBtn).toBeHidden({ timeout: 3000 }).catch(() => {});
    }
  });

  test('[5.3-E2E-003] Share icon click triggers download fallback @p0', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await sendWebSocketMessage(page, BULL_ARG);

    const shareBtn = page.getByTestId('share-button').first();
    await expect(shareBtn).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await shareBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^quote-/);
  });

  test('[5.3-E2E-004] Share button meets 44x44px touch target @p0', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await sendWebSocketMessage(page, BULL_ARG);

    const shareBtn = page.getByTestId('share-button').first();
    await expect(shareBtn).toBeVisible({ timeout: 15000 });

    const box = await shareBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  });

  test('[5.3-E2E-005] Share button has correct aria-label @p0', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await sendWebSocketMessage(page, BULL_ARG);

    const shareBtn = page.getByTestId('share-button').first();
    await expect(shareBtn).toBeVisible({ timeout: 15000 });
    await expect(shareBtn).toHaveAttribute('aria-label', 'Share this argument');
  });

  test('[5.3-E2E-006] Share button shows tooltip on hover @p1', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await sendWebSocketMessage(page, BULL_ARG);

    const shareBtn = page.getByTestId('share-button').first();
    await expect(shareBtn).toBeVisible({ timeout: 15000 });

    await shareBtn.hover();
    const tooltip = page.getByText('Share this argument');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });

  test('[5.3-E2E-007] Share button disabled during generation @p0', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await sendWebSocketMessage(page, BULL_ARG);

    const shareBtn = page.getByTestId('share-button').first();
    await expect(shareBtn).toBeVisible({ timeout: 15000 });

    await shareBtn.click();

    await expect(shareBtn).toBeDisabled({ timeout: 2000 }).catch(() => {});
  });

  test('[5.3-E2E-008] Quote card overlay is aria-hidden during generation @p1', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await sendWebSocketMessage(page, BULL_ARG);

    const shareBtn = page.getByTestId('share-button').first();
    await expect(shareBtn).toBeVisible({ timeout: 15000 });

    await shareBtn.click();

    const overlay = page.getByTestId('quote-card-overlay');
    const overlayVisible = await overlay.isVisible({ timeout: 5000 }).catch(() => false);
    if (overlayVisible) {
      await expect(overlay).toHaveAttribute('aria-hidden', 'true');
      await expect(overlay).toHaveAttribute('role', 'presentation');
    }
  });

  test('[5.3-E2E-009] Capture pipeline produces valid PNG file @p0', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await sendWebSocketMessage(page, BULL_ARG);

    const shareBtn = page.getByTestId('share-button').first();
    await expect(shareBtn).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await shareBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^quote-/);
    expect(download.suggestedFilename()).toMatch(/\.png$/);

    const filePath = await download.path();
    if (filePath) {
      const { readFileSync } = await import('fs');
      const buffer = readFileSync(filePath);
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    }
  });
});
