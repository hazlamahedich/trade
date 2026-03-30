import { test, expect } from '../support/fixtures';
import { type Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import {
  setupControllableWebSocket,
  waitForMockConnection,
  injectStaleDataMessage,
  injectDataRefreshedMessage,
} from '../support/mocks/controllable-websocket';

/**
 * Story 1-6: Stale Data Guard - E2E Tests
 *
 * Tests the complete stale data detection and recovery user journey during
 * active debates. Uses controllable WebSocket mock for deterministic behavior.
 *
 * Duplicate Coverage Guard:
 * - ARIA attribute logic       → Unit: StaleDataWarning.test.tsx
 * - WS DATA_STALE/DATA_REFRESHED parsing → Unit: useDebateSocketStale.test.ts
 * - API stale data block (400) → API: debate-api.spec.ts, E2E: debate-flow.spec.ts
 * - These E2E tests cover the critical USER JOURNEY: stale data detection
 *   during an active debate session with full UI response.
 */

function createDebateMessages() {
  return [
    {
      id: faker.string.uuid(),
      role: 'bull',
      content: faker.lorem.sentence(),
      timestamp: faker.date.recent().toISOString(),
    },
    {
      id: faker.string.uuid(),
      role: 'bear',
      content: faker.lorem.sentence(),
      timestamp: faker.date.recent().toISOString(),
    },
  ];
}

async function setupActiveDebatePage(
  page: Page,
  debateId: string,
  asset: string,
): Promise<void> {
  await setupControllableWebSocket(page);

  await page.route('**/api/debate/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: debateId,
          asset: asset.toLowerCase(),
          status: 'running',
          messages: createDebateMessages(),
        },
      }),
    });
  });

  await page.goto(`/debates/${debateId}`);
  await waitForMockConnection(page);

  const debateStream = page.locator('[data-testid="debate-stream"]');
  await expect(debateStream).toBeVisible({ timeout: 10_000 });
}

test.describe('[1-6] Stale Data Guard E2E Tests', () => {
  test.afterEach(async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wsConnected = await page.evaluate(() => (window as any).__WS_CONNECTED__);
    if (wsConnected) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate(() => (window as any).__testWebSocket__?.close());
    }
  });

  test.describe('[P0] Critical Path', () => {
    test('[1-6-E2E-001] Stale data warning modal appears when DATA_STALE received during active debate @p0 @smoke', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      const asset = faker.helpers.arrayElement(['BTC', 'ETH', 'SOL']);
      const ageSeconds = faker.number.int({ min: 61, max: 300 });

      await setupActiveDebatePage(page, debateId, asset);

      await injectStaleDataMessage(page, debateId, ageSeconds, null);

      await expect(page.getByTestId('stale-data-warning')).toBeVisible({
        timeout: 5_000,
      });
    });

    test('[1-6-E2E-002] Debate stream shows grayscale freeze state when data is stale @p0', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      const asset = faker.helpers.arrayElement(['BTC', 'ETH', 'SOL']);
      const ageSeconds = faker.number.int({ min: 61, max: 300 });

      await setupActiveDebatePage(page, debateId, asset);

      const debateStream = page.locator('[data-testid="debate-stream"]');

      await injectStaleDataMessage(page, debateId, ageSeconds, null);

      await expect(debateStream).toHaveClass(/grayscale/, { timeout: 5_000 });
      await expect(debateStream).toHaveCSS('filter', /grayscale\(.*\)/);
    });
  });

  test.describe('[P1] State Recovery & Interaction', () => {
    test('[1-6-E2E-003] DATA_REFRESHED WebSocket action removes stale state and restores normal stream @p1', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      const ageSeconds = faker.number.int({ min: 61, max: 300 });

      await setupActiveDebatePage(page, debateId, 'BTC');

      await injectStaleDataMessage(page, debateId, ageSeconds, null);
      await expect(page.getByTestId('stale-data-warning')).toBeVisible({
        timeout: 5_000,
      });

      await injectDataRefreshedMessage(page, debateId);

      await expect(page.getByTestId('stale-data-warning')).not.toBeVisible({
        timeout: 5_000,
      });
    });

    test('[1-6-E2E-004] Acknowledge button dismisses stale data warning and restores stream @p1', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      const ageSeconds = faker.number.int({ min: 61, max: 300 });

      await setupActiveDebatePage(page, debateId, 'ETH');

      await injectStaleDataMessage(page, debateId, ageSeconds, null);

      const acknowledgeBtn = page.getByTestId('stale-acknowledge-btn');
      await expect(acknowledgeBtn).toBeVisible({ timeout: 5_000 });

      await acknowledgeBtn.click();

      await expect(page.getByTestId('stale-data-warning')).not.toBeVisible({
        timeout: 3_000,
      });
    });

    test('[1-6-E2E-005] Focus trap confines Tab key to acknowledge button within modal @p1 @accessibility', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      const ageSeconds = faker.number.int({ min: 61, max: 300 });

      await setupActiveDebatePage(page, debateId, 'SOL');

      await injectStaleDataMessage(page, debateId, ageSeconds, null);

      const acknowledgeBtn = page.getByTestId('stale-acknowledge-btn');
      await expect(acknowledgeBtn).toBeVisible({ timeout: 5_000 });

      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      await expect(acknowledgeBtn).toBeFocused();
    });
  });

  test.describe('[P2] Accessibility & Edge Cases', () => {
    test('[1-6-E2E-006] Stale data warning renders with correct ARIA dialog attributes in page context @p2 @accessibility', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      const ageSeconds = faker.number.int({ min: 61, max: 300 });

      await setupActiveDebatePage(page, debateId, 'BTC');

      await injectStaleDataMessage(page, debateId, ageSeconds, null);

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      await expect(dialog).toHaveAttribute('aria-labelledby', 'stale-data-title');
      await expect(dialog).toHaveAttribute('aria-describedby', 'stale-data-description');
    });

    test('[1-6-E2E-007] Acknowledge button receives auto-focus when stale warning appears @p2 @accessibility', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      const ageSeconds = faker.number.int({ min: 61, max: 300 });

      await setupActiveDebatePage(page, debateId, 'ETH');

      await injectStaleDataMessage(page, debateId, ageSeconds, null);

      const acknowledgeBtn = page.getByTestId('stale-acknowledge-btn');
      await expect(acknowledgeBtn).toBeVisible({ timeout: 5_000 });
      await expect(acknowledgeBtn).toBeFocused();
    });

    test('[1-6-E2E-008] Stale data warning triggers haptic vibration heartbeat pattern @p2 @accessibility', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      const ageSeconds = faker.number.int({ min: 61, max: 300 });

      await page.addInitScript(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__vibrateCalls__ = [] as number[][];
        const origVibrate = navigator.vibrate.bind(navigator);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).vibrate = (pattern: number | Iterable<number>) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__vibrateCalls__.push(Array.isArray(pattern) ? pattern : [pattern]);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (origVibrate as any)(pattern);
        };
      });

      await setupActiveDebatePage(page, debateId, 'SOL');
      await injectStaleDataMessage(page, debateId, ageSeconds, null);
      await expect(page.getByTestId('stale-data-warning')).toBeVisible({ timeout: 5_000 });

      const vibrations = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).__vibrateCalls__ as number[][];
      });
      expect(vibrations.length).toBeGreaterThanOrEqual(1);
      expect(vibrations[0]).toEqual([100, 50, 100]);
    });
  });
});
