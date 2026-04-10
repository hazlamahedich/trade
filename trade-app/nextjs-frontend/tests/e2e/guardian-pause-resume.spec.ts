import { test, expect } from '../support/fixtures';
import {
  injectWebSocketInterceptor,
  waitForWebSocketConnection,
  sendWebSocketMessage,
} from '../support/helpers/ws-helpers';
import {
  guardianInterruptPayload,
  debatePausedPayload,
  debateResumedPayload,
  argumentCompletePayload,
} from '../support/helpers/debate-payloads';

/**
 * Story 2.2: Debate Engine Integration — The Pause
 *
 * E2E tests for Guardian interrupt, debate pause/resume, and critical-risk
 * end-of-debate flows in the DebateStream component.
 *
 * NOTE: Story 2.3 replaced the inline acknowledge UI with the GuardianOverlay
 * modal. These tests have been updated to reflect the current UI:
 * - No more ring-violet-600 on the stream (replaced by grayscale filter)
 * - No more inline "Acknowledge & Resume" button (replaced by GuardianOverlay buttons)
 * - No more "awaiting your acknowledgment" text (replaced by GuardianOverlay modal)
 *
 * Uses /test/debate-stream route which directly mounts DebateStream
 * with a known debateId, bypassing the not-yet-built creation flow.
 */
test.describe('[2-2] Guardian Pause & Resume', () => {
  const DEBATE_ID = 'test-debate-guardian-001';

  async function navigateToTestDebate(page: import('@playwright/test').Page) {
    await injectWebSocketInterceptor(page);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-e2e-token');
      localStorage.setItem('tokenExpiry', String(Date.now() + 3600000));
    });

    await page.goto(`/test/debate-stream?debateId=${DEBATE_ID}`);
    await expect(page.locator('[data-testid="debate-stream"]')).toBeVisible({ timeout: 15_000 });
    await waitForWebSocketConnection(page);
  }

  test('[2-2-E2E-001] Guardian interrupt pauses debate and ack resumes @p0 @smoke', async ({
    page,
  }) => {
    await navigateToTestDebate(page);

    await sendWebSocketMessage(page, argumentCompletePayload('bull', 1));
    await sendWebSocketMessage(page, argumentCompletePayload('bear', 2));
    await sendWebSocketMessage(page, guardianInterruptPayload());
    await sendWebSocketMessage(page, debatePausedPayload());

    const guardianMessage = page.locator('[data-testid^="guardian-message-"]').first();
    await expect(guardianMessage).toBeVisible({ timeout: 10_000 });

    const overlay = page.locator('[data-testid="guardian-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    const debateStream = page.locator('[data-testid="debate-stream"]');
    const filterValue = await debateStream.evaluate((el) => (el as HTMLElement).style.filter);
    expect(filterValue).toContain('grayscale(60%)');

    const understandBtn = page.locator('[data-testid="guardian-understand-btn"]');
    await expect(understandBtn).toBeVisible({ timeout: 10_000 });
    await understandBtn.click();

    await sendWebSocketMessage(page, debateResumedPayload());

    await expect(overlay).not.toBeVisible({ timeout: 10_000 });
    const unfrozenFilter = await debateStream.evaluate((el) => (el as HTMLElement).style.filter);
    expect(unfrozenFilter).toBe('none');
  });

  test('[2-2-E2E-002] Critical interrupt ends debate with no resume @p0', async ({ page }) => {
    await navigateToTestDebate(page);

    await sendWebSocketMessage(
      page,
      guardianInterruptPayload({ riskLevel: 'critical', summaryVerdict: 'Critical' }),
    );
    await sendWebSocketMessage(
      page,
      debatePausedPayload({ riskLevel: 'critical', summaryVerdict: 'Critical' }),
    );

    const overlay = page.locator('[data-testid="guardian-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('[data-testid="guardian-ignore-btn"]')).not.toBeVisible({ timeout: 5_000 });

    await expect(
      overlay.getByText('Critical risk detected — debate ended'),
    ).toBeVisible({ timeout: 10_000 });

    const guardianMessage = page.locator('[data-testid^="guardian-message-"]').first();
    await expect(guardianMessage).toBeVisible({ timeout: 10_000 });
  });

  test('[2-2-E2E-003] Guardian message renders as centered Violet-600 bubble @p1', async ({
    page,
  }) => {
    await navigateToTestDebate(page);

    await sendWebSocketMessage(page, guardianInterruptPayload());
    await sendWebSocketMessage(page, debatePausedPayload());

    const guardianMessage = page.locator('[data-testid^="guardian-message-"]').first();
    await expect(guardianMessage).toBeVisible({ timeout: 10_000 });

    const innerBubble = guardianMessage.locator('div.bg-violet-600\\/20');
    await expect(innerBubble).toBeVisible({ timeout: 10_000 });

    const shieldSvg = innerBubble.locator('svg').first();
    await expect(shieldSvg).toBeVisible();

    await expect(innerBubble.getByText(/GUARDIAN:/)).toBeVisible();
  });

  test('[2-2-E2E-004] Guardian overlay shows verdict and reason when active @p1', async ({
    page,
  }) => {
    await navigateToTestDebate(page);

    await sendWebSocketMessage(page, guardianInterruptPayload());
    await sendWebSocketMessage(page, debatePausedPayload());

    const overlay = page.locator('[data-testid="guardian-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    await expect(overlay.getByText('High Risk')).toBeVisible({ timeout: 5_000 });
    await expect(
      overlay.getByText(/Detected anchoring bias/),
    ).toBeVisible();
  });

  test('[2-2-E2E-005] Grayscale filter applied to stream when paused @p1', async ({ page }) => {
    await navigateToTestDebate(page);

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 10_000 });
    const initialFilter = await debateStream.evaluate((el) => (el as HTMLElement).style.filter);
    expect(initialFilter).toBe('none');

    await sendWebSocketMessage(page, guardianInterruptPayload());
    await sendWebSocketMessage(page, debatePausedPayload());

    const frozenFilter = await debateStream.evaluate(
      (el) => (el as HTMLElement).style.filter,
      { timeout: 10_000 },
    );
    expect(frozenFilter).toContain('grayscale(60%)');
  });

  test('[2-2-E2E-006] Rapid sequential pauses update guardian message @p2', async ({
    page,
  }) => {
    await navigateToTestDebate(page);

    await sendWebSocketMessage(page, guardianInterruptPayload({ turn: 2 }));
    await sendWebSocketMessage(page, debatePausedPayload({ turn: 2 }));

    const guardianMessage = page.locator('[data-testid^="guardian-message-"]').first();
    await expect(guardianMessage).toBeVisible({ timeout: 10_000 });

    const overlay = page.locator('[data-testid="guardian-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    await sendWebSocketMessage(page, guardianInterruptPayload({ turn: 3, fallacyType: 'confirmation_bias', reason: 'Confirmation bias detected.' }));
    await sendWebSocketMessage(page, debatePausedPayload({ turn: 3 }));

    const allGuardianMessages = page.locator('[data-testid^="guardian-message-"]');
    await expect(allGuardianMessages).toHaveCount(4, { timeout: 10_000 });
    await expect(overlay).toBeVisible();
  });

  test('[2-2-E2E-007] Resume after ack clears paused state completely @p2', async ({
    page,
  }) => {
    await navigateToTestDebate(page);

    await sendWebSocketMessage(page, guardianInterruptPayload());
    await sendWebSocketMessage(page, debatePausedPayload());

    const overlay = page.locator('[data-testid="guardian-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    const debateStream = page.locator('[data-testid="debate-stream"]');
    const frozenFilter = await debateStream.evaluate((el) => (el as HTMLElement).style.filter);
    expect(frozenFilter).toContain('grayscale(60%)');

    const understandBtn = page.locator('[data-testid="guardian-understand-btn"]');
    await expect(understandBtn).toBeVisible({ timeout: 10_000 });
    await understandBtn.click();

    await sendWebSocketMessage(page, debateResumedPayload());

    await expect(overlay).not.toBeVisible({ timeout: 10_000 });
    const unfrozenFilter = await debateStream.evaluate((el) => (el as HTMLElement).style.filter);
    expect(unfrozenFilter).toBe('none');

    await sendWebSocketMessage(page, argumentCompletePayload('bull', 3));
    const argumentBubble = page.locator('[data-testid="argument-bubble"]').first();
    await expect(argumentBubble).toBeVisible({ timeout: 10_000 });
  });
});
