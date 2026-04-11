import { test, expect } from '../support/fixtures';
import { setupApiMocks } from '../support/helpers/api-mock';
import { setupMockedWebSocketPage } from '../support/helpers/e2e-mock-websocket';

test.describe('[2-5] Moderation Transparency — Safety Badge (P0)', () => {
  test('[2-5-E2E-001] Redacted argument shows "Safety Filtered" indicator @p0', async ({ page }) => {
    await setupApiMocks(page);
    await setupMockedWebSocketPage(page, {
      messages: [
        {
          type: 'DEBATE/ARGUMENT_COMPLETE',
          payload: {
            debateId: 'test-badge-1',
            agent: 'bull',
            content: 'This is a [REDACTED] profit opportunity with strong fundamentals.',
            turn: 1,
            isRedacted: true,
          },
        },
      ],
    });

    await page.goto('/debates/test-badge-1');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId('safety-filtered-badge')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Safety Filtered')).toBeVisible();
  });

  test('[2-5-E2E-002] Non-redacted messages have no indicator element @p0', async ({ page }) => {
    await setupApiMocks(page);
    await setupMockedWebSocketPage(page, {
      messages: [
        {
          type: 'DEBATE/ARGUMENT_COMPLETE',
          payload: {
            debateId: 'test-badge-2',
            agent: 'bear',
            content: 'Market conditions suggest potential downside risk due to regulatory uncertainty.',
            turn: 1,
            isRedacted: false,
          },
        },
      ],
    });

    await page.goto('/debates/test-badge-2');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 15000 });

    await expect(page.locator('[data-testid="safety-filtered-badge"]')).not.toBeVisible();
  });

  test('[2-5-E2E-003] Tooltip renders without clipping near viewport bottom @p1', async ({ page }) => {
    await setupApiMocks(page);
    await setupMockedWebSocketPage(page, {
      messages: [
        {
          type: 'DEBATE/ARGUMENT_COMPLETE',
          payload: {
            debateId: 'test-badge-3',
            agent: 'bull',
            content: 'This is a [REDACTED] opportunity.',
            turn: 1,
            isRedacted: true,
          },
        },
      ],
    });

    await page.setViewportSize({ width: 800, height: 400 });
    await page.goto('/debates/test-badge-3');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 15000 });

    const badge = page.getByTestId('safety-filtered-badge');
    await expect(badge).toBeVisible({ timeout: 10000 });

    await badge.focus();
    await expect(page.getByText('This content was filtered to keep the discussion respectful.')).toBeVisible({ timeout: 5000 });
  });

  test('[2-5-E2E-004] Mobile viewport: inline explanation text visible without tooltip @p1', async ({ page }) => {
    await setupApiMocks(page);
    await setupMockedWebSocketPage(page, {
      messages: [
        {
          type: 'DEBATE/ARGUMENT_COMPLETE',
          payload: {
            debateId: 'test-badge-4',
            agent: 'bull',
            content: 'This is a [REDACTED] profit opportunity.',
            turn: 1,
            isRedacted: true,
          },
        },
      ],
    });

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/debates/test-badge-4');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 15000 });

    const mobileBadge = page.getByTestId('safety-filtered-mobile');
    await expect(mobileBadge).toBeVisible({ timeout: 10000 });
    await expect(mobileBadge).toContainText('This content was filtered to keep the discussion respectful');
  });
});
