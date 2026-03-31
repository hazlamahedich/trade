import { test, expect } from '../support/fixtures';
import { type Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import {
  setupControllableWebSocket,
  waitForMockConnection,
  injectReasoningNodeMessage,
} from '../support/mocks/controllable-websocket';

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

test.describe('[1-7] Reasoning Graph Accessibility E2E Tests', () => {
  test.afterEach(async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wsConnected = await page.evaluate(() => (window as any).__WS_CONNECTED__);
    if (wsConnected) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate(() => (window as any).__testWebSocket__?.close());
    }
  });

  test('[1-7-E2E-008] prefers-reduced-motion disables animations on graph nodes @p1 @accessibility', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const debateId = faker.string.uuid();
    await setupActiveDebatePage(page, debateId, 'MATIC');

    await injectReasoningNodeMessage(page, {
      debateId,
      nodeId: 'data-MATIC-a11y',
      nodeType: 'data_input',
      label: 'MATIC Market Data',
      summary: 'Loaded',
    });

    const graphContainer = page.locator('[data-testid="reasoning-graph-container"]');
    await expect(graphContainer).toBeVisible({ timeout: 10_000 });

    const dataInputNode = page.getByRole('group', { name: /Data Input: MATIC Market Data/i });
    await expect(dataInputNode).toBeVisible({ timeout: 5_000 });

    await expect(dataInputNode).toHaveCSS('opacity', '1');
  });

  test('[1-7-E2E-009] keyboard Tab cycles through graph nodes @p1 @accessibility', async ({
    page,
  }) => {
    const debateId = faker.string.uuid();
    await setupActiveDebatePage(page, debateId, 'UNI');

    await injectReasoningNodeMessage(page, {
      debateId,
      nodeId: 'data-UNI-kb',
      nodeType: 'data_input',
      label: 'UNI Market Data',
      summary: 'Loaded',
    });

    await injectReasoningNodeMessage(page, {
      debateId,
      nodeId: 'bull-turn-1',
      nodeType: 'bull_analysis',
      label: 'Bull Argument #1',
      summary: 'Bullish case',
      agent: 'bull',
      parentId: 'data-UNI-kb',
      turn: 1,
    });

    const graphContainer = page.locator('[data-testid="reasoning-graph-container"]');
    await expect(graphContainer).toBeVisible({ timeout: 10_000 });

    const dataInputNode = page.getByRole('group', { name: /Data Input: UNI Market Data/i });
    await expect(dataInputNode).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    const groups = page.locator('[role="group"]');
    await expect(groups).toHaveCount(2);
  });
});
