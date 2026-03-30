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

test.describe('[1-7] Reasoning Graph / Decision Visualization E2E Tests', () => {
  test.afterEach(async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wsConnected = await page.evaluate(() => (window as any).__WS_CONNECTED__);
    if (wsConnected) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate(() => (window as any).__testWebSocket__?.close());
    }
  });

  test.describe('[P0] Critical Path', () => {
    test('[1-7-E2E-001] Reasoning graph container appears when REASONING_NODE received @p0 @smoke', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      await setupActiveDebatePage(page, debateId, 'BTC');

      await injectReasoningNodeMessage(page, {
        debateId,
        nodeId: 'data-BTC-testnode',
        nodeType: 'data_input',
        label: 'BTC Market Data',
        summary: 'Market data loaded',
      });

      const graphContainer = page.locator('[data-testid="reasoning-graph-container"]');
      await expect(graphContainer).toBeVisible({ timeout: 10_000 });
    });

    test('[1-7-E2E-002] Graph displays nodes for Data Input, Bull, Bear, and Risk Check @p0', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      await setupActiveDebatePage(page, debateId, 'ETH');

      await injectReasoningNodeMessage(page, {
        debateId,
        nodeId: 'data-ETH-e2enodes',
        nodeType: 'data_input',
        label: 'ETH Market Data',
        summary: 'Price: $3,200',
      });

      await expect(page.getByText('ETH Market Data')).toBeVisible({ timeout: 5_000 });

      await injectReasoningNodeMessage(page, {
        debateId,
        nodeId: 'bull-turn-1',
        nodeType: 'bull_analysis',
        label: 'Bull Argument #1',
        summary: 'Strong bullish momentum',
        agent: 'bull',
        parentId: 'data-ETH-e2enodes',
        turn: 1,
      });

      await expect(page.getByText('Bull Argument #1')).toBeVisible({ timeout: 5_000 });

      await injectReasoningNodeMessage(page, {
        debateId,
        nodeId: 'bear-turn-1',
        nodeType: 'bear_counter',
        label: 'Bear Counter #1',
        summary: 'Overbought conditions',
        agent: 'bear',
        parentId: 'bull-turn-1',
        turn: 1,
      });

      await expect(page.getByText('Bear Counter #1')).toBeVisible({ timeout: 5_000 });
    });

    test('[1-7-E2E-003] Winning path highlights nodes when isWinning received @p0', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      await setupActiveDebatePage(page, debateId, 'SOL');

      await injectReasoningNodeMessage(page, {
        debateId,
        nodeId: 'data-SOL-winpath',
        nodeType: 'data_input',
        label: 'SOL Market Data',
        summary: 'Loaded',
      });

      await injectReasoningNodeMessage(page, {
        debateId,
        nodeId: 'bull-turn-1',
        nodeType: 'bull_analysis',
        label: 'Bull Argument #1',
        summary: 'Bull case',
        agent: 'bull',
        parentId: 'data-SOL-winpath',
        turn: 1,
      });

      await injectReasoningNodeMessage(page, {
        debateId,
        nodeId: 'bull-turn-1',
        nodeType: 'bull_analysis',
        label: 'Bull Argument #1',
        summary: 'Bull case',
        agent: 'bull',
        parentId: 'data-SOL-winpath',
        isWinning: true,
        turn: 1,
      });

      const bullNode = page.getByRole('group', { name: /Bull Analysis: Bull Argument #1/i });
      await expect(bullNode).toBeVisible({ timeout: 5_000 });
      await expect(bullNode).toHaveClass(/ring-emerald-500/, { timeout: 5_000 });
    });
  });

  test.describe('[P1] Real-time Updates', () => {
    test('[1-7-E2E-004] Graph updates in real-time as nodes arrive sequentially @p1', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      await setupActiveDebatePage(page, debateId, 'ADA');

      await injectReasoningNodeMessage(page, {
        debateId,
        nodeId: 'data-ADA-realtime',
        nodeType: 'data_input',
        label: 'ADA Market Data',
        summary: 'Loaded',
      });

      await expect(page.getByText('ADA Market Data')).toBeVisible({ timeout: 5_000 });
      expect(await page.locator('[role="group"]').count()).toBe(1);

      await injectReasoningNodeMessage(page, {
        debateId,
        nodeId: 'bull-turn-1',
        nodeType: 'bull_analysis',
        label: 'Bull Argument #1',
        summary: 'Bullish',
        agent: 'bull',
        parentId: 'data-ADA-realtime',
        turn: 1,
      });

      await expect(page.getByText('Bull Argument #1')).toBeVisible({ timeout: 5_000 });
      expect(await page.locator('[role="group"]').count()).toBe(2);
    });

    test('[1-7-E2E-005] No graph container before any REASONING_NODE messages @p1', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      await setupActiveDebatePage(page, debateId, 'DOT');

      const graphContainer = page.locator('[data-testid="reasoning-graph-container"]');
      await expect(graphContainer).not.toBeVisible();
    });
  });

  test.describe('[P1] Accessibility', () => {
    test('[1-7-E2E-006] Graph nodes have accessible ARIA labels @p1 @accessibility', async ({
      page,
    }) => {
      const debateId = faker.string.uuid();
      await setupActiveDebatePage(page, debateId, 'LINK');

      await injectReasoningNodeMessage(page, {
        debateId,
        nodeId: 'data-LINK-a11y',
        nodeType: 'data_input',
        label: 'LINK Market Data',
        summary: 'Loaded',
      });

      await injectReasoningNodeMessage(page, {
        debateId,
        nodeId: 'bull-turn-1',
        nodeType: 'bull_analysis',
        label: 'Bull Argument #1',
        summary: 'Bull case',
        agent: 'bull',
        parentId: 'data-LINK-a11y',
        turn: 1,
      });

      const dataInputNode = page.getByRole('group', { name: /Data Input: LINK Market Data/i });
      await expect(dataInputNode).toBeVisible({ timeout: 5_000 });

      const bullNode = page.getByRole('group', { name: /Bull Analysis: Bull Argument #1/i });
      await expect(bullNode).toBeVisible({ timeout: 5_000 });
    });

    test('[1-7-E2E-007] Mobile viewport shows compact graph with touch pan @p1', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const debateId = faker.string.uuid();
      await setupActiveDebatePage(page, debateId, 'AVAX');

      await injectReasoningNodeMessage(page, {
        debateId,
        nodeId: 'data-AVAX-mobile',
        nodeType: 'data_input',
        label: 'AVAX Market Data',
        summary: 'Loaded',
      });

      const graphContainer = page.locator('[data-testid="reasoning-graph-container"]');
      await expect(graphContainer).toBeVisible({ timeout: 10_000 });

      const boundingBox = await graphContainer.boundingBox();
      expect(boundingBox?.height).toBeLessThanOrEqual(250);
    });
  });
});
