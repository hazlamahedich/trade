import { test, expect } from '../support/fixtures';
import { setupApiMocks } from '../support/helpers/api-mock';
import { setupMockedWebSocketPage } from '../support/helpers/e2e-mock-websocket';

test.describe('[2-4] Forbidden Phrase Filter — Redacted Argument Display (P0)', () => {
  test('[2-4-E2E-001] Redacted argument displays [REDACTED] in debate stream @p0', async ({ page }) => {
    await setupApiMocks(page);
    await setupMockedWebSocketPage(page, {
      messages: [
        {
          type: 'DEBATE/ARGUMENT_COMPLETE',
          payload: {
            debateId: 'test-debate-redacted',
            agent: 'bull',
            content: 'This is a [REDACTED] profit opportunity with strong fundamentals.',
            turn: 1,
            isRedacted: true,
          },
        },
      ],
    });

    await page.goto('/debates/test-debate-redacted');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('[REDACTED]')).toBeVisible({ timeout: 10000 });

    const argumentBubble = page.locator('[data-agent="bull"]').first();
    await expect(argumentBubble).toBeVisible();

    const content = page.locator('[data-testid="argument-content"]').first();
    await expect(content).toContainText('[REDACTED]');
  });

  test('[2-4-E2E-002] Non-redacted argument displays normally without [REDACTED] @p0', async ({ page }) => {
    await setupApiMocks(page);
    await setupMockedWebSocketPage(page, {
      messages: [
        {
          type: 'DEBATE/ARGUMENT_COMPLETE',
          payload: {
            debateId: 'test-debate-clean',
            agent: 'bear',
            content: 'Market conditions suggest potential downside risk due to regulatory uncertainty.',
            turn: 1,
            isRedacted: false,
          },
        },
      ],
    });

    await page.goto('/debates/test-debate-clean');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('regulatory uncertainty')).toBeVisible({ timeout: 10000 });

    const content = page.locator('[data-testid="argument-content"]').first();
    await expect(content).toBeVisible();
    await expect(content).not.toContainText('[REDACTED]');
  });

  test('[2-4-E2E-003] Multiple redacted arguments across turns @p1', async ({ page }) => {
    await setupApiMocks(page);
    await setupMockedWebSocketPage(page, {
      messages: [
        {
          type: 'DEBATE/ARGUMENT_COMPLETE',
          payload: {
            debateId: 'test-debate-multi',
            agent: 'bull',
            content: 'This is a [REDACTED] investment with [REDACTED] returns.',
            turn: 1,
            isRedacted: true,
          },
          delay: 0,
        },
        {
          type: 'DEBATE/ARGUMENT_COMPLETE',
          payload: {
            debateId: 'test-debate-multi',
            agent: 'bear',
            content: 'However, there are significant risks including market volatility.',
            turn: 2,
            isRedacted: false,
          },
          delay: 500,
        },
      ],
    });

    await page.goto('/debates/test-debate-multi');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 15000 });

    const redactedContents = page.locator('[data-testid="argument-content"]');
    await expect(redactedContents.first()).toContainText('[REDACTED]', { timeout: 10000 });

    await expect(page.getByText('market volatility')).toBeVisible({ timeout: 10000 });
  });

  test('[2-4-E2E-004] Streaming tokens replaced by redacted ARGUMENT_COMPLETE @p1', async ({ page }) => {
    await setupApiMocks(page);
    await setupMockedWebSocketPage(page, {
      messages: [],
      tokenMessages: ['This', ' ', 'is', ' ', 'guaranteed', ' ', 'profit'],
      tokenInterval: 100,
      onComplete: {
        type: 'DEBATE/ARGUMENT_COMPLETE',
        payload: {
          debateId: 'test-stream-redacted',
          agent: 'bull',
          content: 'This is [REDACTED] profit',
          turn: 1,
          isRedacted: true,
        },
      },
    });

    await page.goto('/debates/test-stream-redacted');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('[REDACTED]')).toBeVisible({ timeout: 15000 });

    const content = page.locator('[data-testid="argument-content"]').first();
    await expect(content).toContainText('[REDACTED]');
    await expect(content).toContainText('profit');
  });
});
