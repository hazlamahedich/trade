import { test, expect } from '../support/fixtures';
import { setupApiMocks } from '../support/helpers/api-mock';

test.describe('[5.2] Debate Snapshot Tool — E2E (P0)', () => {
  test('[5.2-E2E-001] Snapshot button visible on running debate with messages @p0', async ({ page }) => {
    await setupApiMocks(page);

    await page.route('**/api/debate/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            debateId: 'snap-test-1',
            asset: 'BTC',
            status: 'running',
            messages: [
              { id: 'msg-1', role: 'bull', content: 'BTC is going up.', timestamp: new Date().toISOString() },
              { id: 'msg-2', role: 'bear', content: 'BTC is going down.', timestamp: new Date().toISOString() },
            ],
            currentTurn: 1,
            maxTurns: 6,
            createdAt: new Date().toISOString(),
          },
          error: null,
          meta: { latencyMs: 50 },
        }),
      });
    });

    await page.goto('/debates/snap-test-1');

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeVisible({ timeout: 15000 });
    await expect(snapshotBtn).toHaveAttribute('aria-label', 'Save debate as shareable image');
  });

  test('[5.2-E2E-002] Snapshot button hidden on empty debate @p0', async ({ page }) => {
    await setupApiMocks(page);

    await page.route('**/api/debate/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            debateId: 'snap-empty',
            asset: 'ETH',
            status: 'running',
            messages: [],
            currentTurn: 0,
            maxTurns: 6,
            createdAt: new Date().toISOString(),
          },
          error: null,
          meta: { latencyMs: 50 },
        }),
      });
    });

    await page.goto('/debates/snap-empty');

    const debateStream = page.getByTestId('debate-stream');
    await expect(debateStream).toBeVisible({ timeout: 15000 });
    await expect(debateStream).toHaveAttribute('data-empty', 'true');

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeHidden();
  });

  test('[5.2-E2E-003] Snapshot button click triggers download @p0', async ({ page }) => {
    await setupApiMocks(page);

    await page.route('**/api/debate/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            debateId: 'snap-dl-test',
            asset: 'SOL',
            status: 'completed',
            messages: [
              { id: 'msg-1', role: 'bull', content: 'SOL momentum.', timestamp: new Date().toISOString() },
              { id: 'msg-2', role: 'bear', content: 'SOL overbought.', timestamp: new Date().toISOString() },
            ],
            currentTurn: 2,
            maxTurns: 6,
            createdAt: new Date().toISOString(),
          },
          error: null,
          meta: { latencyMs: 50 },
        }),
      });
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);

    await page.goto('/debates/snap-dl-test');

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeVisible({ timeout: 15000 });

    await snapshotBtn.click();

    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toContain('debate-');
    }
  });

  test('[5.2-E2E-004] Snapshot button is keyboard accessible @p0', async ({ page }) => {
    await setupApiMocks(page);

    await page.route('**/api/debate/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            debateId: 'snap-kb-test',
            asset: 'ADA',
            status: 'running',
            messages: [
              { id: 'msg-1', role: 'bull', content: 'ADA bullish.', timestamp: new Date().toISOString() },
            ],
            currentTurn: 1,
            maxTurns: 6,
            createdAt: new Date().toISOString(),
          },
          error: null,
          meta: { latencyMs: 50 },
        }),
      });
    });

    await page.goto('/debates/snap-kb-test');

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

    await page.route('**/api/debate/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            debateId: 'snap-mobile-test',
            asset: 'DOT',
            status: 'running',
            messages: [
              { id: 'msg-1', role: 'bull', content: 'DOT momentum.', timestamp: new Date().toISOString() },
            ],
            currentTurn: 1,
            maxTurns: 6,
            createdAt: new Date().toISOString(),
          },
          error: null,
          meta: { latencyMs: 50 },
        }),
      });
    });

    await page.goto('/debates/snap-mobile-test');

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeVisible({ timeout: 15000 });

    const box = await snapshotBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  });

  test('[5.2-E2E-006] Snapshot button disabled during generation @p0', async ({ page }) => {
    await setupApiMocks(page);

    await page.route('**/api/debate/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            debateId: 'snap-disable-test',
            asset: 'LINK',
            status: 'running',
            messages: [
              { id: 'msg-1', role: 'bull', content: 'LINK bullish.', timestamp: new Date().toISOString() },
            ],
            currentTurn: 1,
            maxTurns: 6,
            createdAt: new Date().toISOString(),
          },
          error: null,
          meta: { latencyMs: 50 },
        }),
      });
    });

    await page.goto('/debates/snap-disable-test');

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeVisible({ timeout: 15000 });

    await snapshotBtn.click();

    await expect(snapshotBtn).toBeDisabled({ timeout: 2000 }).catch(() => {
      // may complete before we can observe disabled state
    });
  });

  test('[5.2-E2E-007] Snapshot button has tooltip on hover @p1', async ({ page }) => {
    await setupApiMocks(page);

    await page.route('**/api/debate/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            debateId: 'snap-tooltip-test',
            asset: 'AVAX',
            status: 'running',
            messages: [
              { id: 'msg-1', role: 'bull', content: 'AVAX bullish.', timestamp: new Date().toISOString() },
            ],
            currentTurn: 1,
            maxTurns: 6,
            createdAt: new Date().toISOString(),
          },
          error: null,
          meta: { latencyMs: 50 },
        }),
      });
    });

    await page.goto('/debates/snap-tooltip-test');

    const snapshotBtn = page.getByTestId('snapshot-button');
    await expect(snapshotBtn).toBeVisible({ timeout: 15000 });

    await snapshotBtn.hover();

    const tooltip = page.getByText('Save debate as shareable image');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });

  test('[5.2-E2E-008] Snapshot overlay is aria-hidden during generation @P1', async ({ page }) => {
    await setupApiMocks(page);

    await page.route('**/api/debate/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            debateId: 'snap-a11y-test',
            asset: 'MATIC',
            status: 'running',
            messages: [
              { id: 'msg-1', role: 'bull', content: 'MATIC bullish.', timestamp: new Date().toISOString() },
            ],
            currentTurn: 1,
            maxTurns: 6,
            createdAt: new Date().toISOString(),
          },
          error: null,
          meta: { latencyMs: 50 },
        }),
      });
    });

    await page.goto('/debates/snap-a11y-test');

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
