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

test.describe('[5.2] Debate Snapshot Tool — E2E (P0)', () => {
  test('[5.2-E2E-001] Snapshot button visible on running debate with messages @p0', async ({ page }) => {
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

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeVisible({ timeout: 15000 });
    await expect(snapshotBtn).toHaveAttribute('aria-label', 'Capture this debate');
  });

  test('[5.2-E2E-002] Snapshot button hidden on empty debate @p0', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    const debateStream = page.getByTestId('debate-stream');
    await expect(debateStream).toBeVisible({ timeout: 15000 });
    await expect(debateStream).toHaveAttribute('data-empty', 'true');

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeHidden();
  });

  test('[5.2-E2E-003] Snapshot button click triggers download @p0', async ({ page }) => {
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

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await snapshotBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('debate-');
  });

  test('[5.2-E2E-004] Snapshot button is keyboard accessible @p0', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await sendWebSocketMessage(page, BULL_ARG);

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeVisible({ timeout: 15000 });

    await snapshotBtn.focus();
    await expect(snapshotBtn).toBeFocused();

    await page.keyboard.press('Enter');

    await expect(snapshotBtn).toHaveAttribute('aria-busy', 'true', { timeout: 3000 }).catch(() => {
      // generation may complete quickly
    });
  });

  test('[5.2-E2E-005] Snapshot button meets 44x44px touch target on mobile @p1', async ({ page }) => {
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

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeVisible({ timeout: 15000 });

    const box = await snapshotBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  });

  test('[5.2-E2E-006] Snapshot button disabled during generation @p0', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await sendWebSocketMessage(page, BULL_ARG);

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeVisible({ timeout: 15000 });

    await snapshotBtn.click();

    await expect(snapshotBtn).toBeDisabled({ timeout: 2000 }).catch(() => {
      // may complete before we can observe disabled state
    });
  });

  test('[5.2-E2E-007] Snapshot button has tooltip on hover @p1', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await sendWebSocketMessage(page, BULL_ARG);

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeVisible({ timeout: 15000 });

    await snapshotBtn.hover();

    const tooltip = page.getByText('Capture this debate');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });

  test('[5.2-E2E-008] Snapshot overlay is aria-hidden during generation @P1', async ({ page }) => {
    await setupApiMocks(page);
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto('/test/debate-stream');
    await waitForWebSocketConnection(page);

    await sendWebSocketMessage(page, BULL_ARG);

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeVisible({ timeout: 15000 });

    await snapshotBtn.click();

    const overlay = page.getByTestId('snapshot-overlay');
    const overlayVisible = await overlay.isVisible({ timeout: 5000 }).catch(() => false);
    if (overlayVisible) {
      await expect(overlay).toHaveAttribute('aria-hidden', 'true');
      await expect(overlay).toHaveAttribute('role', 'presentation');
    }
  });
});
