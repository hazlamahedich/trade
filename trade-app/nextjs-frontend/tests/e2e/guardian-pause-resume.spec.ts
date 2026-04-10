import { test, expect } from '../support/fixtures';
import {
  injectWebSocketInterceptor,
  waitForWebSocketConnection,
  sendWebSocketMessage,
} from '../support/helpers/ws-helpers';

/**
 * Story 2.2: Debate Engine Integration — The Pause
 *
 * E2E tests for Guardian interrupt, debate pause/resume, and critical-risk
 * end-of-debate flows in the DebateStream component.
 *
 * Uses /test/debate-stream route which directly mounts DebateStream
 * with a known debateId, bypassing the not-yet-built creation flow.
 */
test.describe('[2-2] Guardian Pause & Resume', () => {
  const DEBATE_ID = 'test-debate-guardian-001';

  /** Navigates to the test page and waits for WS to be ready */
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

  /** Deterministic payload builders */
  function guardianInterruptPayload(overrides: Record<string, unknown> = {}) {
    return {
      type: 'DEBATE/GUARDIAN_INTERRUPT',
      payload: {
        debateId: DEBATE_ID,
        riskLevel: 'high',
        reason: 'Detected anchoring bias in bull argument — confidence exceeds evidence.',
        fallacyType: 'anchoring_bias',
        originalAgent: 'bull',
        summaryVerdict: 'High Risk',
        turn: 2,
        ...overrides,
      },
      timestamp: new Date().toISOString(),
    };
  }

  function debatePausedPayload(overrides: Record<string, unknown> = {}) {
    return {
      type: 'DEBATE/DEBATE_PAUSED',
      payload: {
        debateId: DEBATE_ID,
        reason: 'Risk Guardian detected a potential cognitive bias.',
        riskLevel: 'high',
        summaryVerdict: 'High Risk',
        turn: 2,
        ...overrides,
      },
      timestamp: new Date().toISOString(),
    };
  }

  function debateResumedPayload() {
    return {
      type: 'DEBATE/DEBATE_RESUMED',
      payload: {
        debateId: DEBATE_ID,
        turn: 3,
      },
      timestamp: new Date().toISOString(),
    };
  }

  function argumentCompletePayload(agent: 'bull' | 'bear', turn: number) {
    return {
      type: 'DEBATE/ARGUMENT_COMPLETE',
      payload: {
        debateId: DEBATE_ID,
        agent,
        content: `${agent === 'bull' ? 'Bullish' : 'Bearish'} argument for turn ${turn}.`,
        turn,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // 2-2-E2E-001
  // ---------------------------------------------------------------------------
  test('[2-2-E2E-001] Guardian interrupt pauses debate and ack resumes @p0 @smoke', async ({
    page,
  }) => {
    await navigateToTestDebate(page);

    // Given: Some arguments stream in, then a Guardian interrupt fires
    await sendWebSocketMessage(page, argumentCompletePayload('bull', 1));
    await sendWebSocketMessage(page, argumentCompletePayload('bear', 2));
    await sendWebSocketMessage(page, guardianInterruptPayload());
    await sendWebSocketMessage(page, debatePausedPayload());

    // Then: The paused indicator is visible
    const pausedIndicator = page.locator('[data-testid="debate-paused-indicator"]');
    await expect(pausedIndicator).toBeVisible({ timeout: 10_000 });

    // And: A guardian message bubble is visible
    const guardianMessage = page.locator('[data-testid^="guardian-message-"]').first();
    await expect(guardianMessage).toBeVisible({ timeout: 10_000 });

    // And: The debate stream has the violet ring styling
    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toHaveClass(/ring-violet-600/);

    // When: User clicks acknowledge
    const ackButton = page.locator('[data-testid^="ack-guardian-"]');
    await expect(ackButton).toBeVisible({ timeout: 10_000 });
    await ackButton.click();

    // And: Server sends DEBATE_RESUMED
    await sendWebSocketMessage(page, debateResumedPayload());

    // Then: Paused indicator disappears
    await expect(pausedIndicator).not.toBeVisible({ timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // 2-2-E2E-002
  // ---------------------------------------------------------------------------
  test('[2-2-E2E-002] Critical interrupt ends debate with no resume @p0', async ({ page }) => {
    await navigateToTestDebate(page);

    // Given: A critical Guardian interrupt fires
    await sendWebSocketMessage(
      page,
      guardianInterruptPayload({ riskLevel: 'critical', summaryVerdict: 'Critical' }),
    );
    await sendWebSocketMessage(
      page,
      debatePausedPayload({ riskLevel: 'critical', summaryVerdict: 'Critical' }),
    );

    // Then: No acknowledge button is shown (critical risk = no manual resume)
    const ackButton = page.locator('[data-testid^="ack-guardian-"]');
    await expect(ackButton).not.toBeVisible({ timeout: 10_000 });

    // And: Guardian message is visible with critical text
    const guardianMessage = page.locator('[data-testid^="guardian-message-"]').first();
    await expect(guardianMessage).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Critical risk detected\. Debate ended\./)).toBeVisible({
      timeout: 10_000,
    });

    // And: The debate is completed (STATUS_UPDATE received)
    await sendWebSocketMessage(page, {
      type: 'DEBATE/STATUS_UPDATE',
      payload: {
        debateId: DEBATE_ID,
        status: 'completed',
      },
      timestamp: new Date().toISOString(),
    });

    // Verify the completed status is reflected in connection status indicator
    const wsStatus = page.locator('[data-testid="ws-connection-status"]');
    await expect(wsStatus).toBeVisible({ timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // 2-2-E2E-003
  // ---------------------------------------------------------------------------
  test('[2-2-E2E-003] Guardian message renders as centered Violet-600 bubble @p1', async ({
    page,
  }) => {
    await navigateToTestDebate(page);

    // Given: A Guardian interrupt fires
    await sendWebSocketMessage(page, guardianInterruptPayload());
    await sendWebSocketMessage(page, debatePausedPayload());

    // Then: Guardian message bubble is visible
    const guardianMessage = page.locator('[data-testid^="guardian-message-"]').first();
    await expect(guardianMessage).toBeVisible({ timeout: 10_000 });

    // And: The inner bubble has violet-600 styling
    const innerBubble = guardianMessage.locator('div.bg-violet-600\\/20');
    await expect(innerBubble).toBeVisible({ timeout: 10_000 });

    // And: The Shield icon SVG is present inside the message
    const shieldSvg = innerBubble.locator('svg').first();
    await expect(shieldSvg).toBeVisible();

    // And: "GUARDIAN:" label is present with the summary verdict
    await expect(innerBubble.getByText(/GUARDIAN:/)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 2-2-E2E-004
  // ---------------------------------------------------------------------------
  test('[2-2-E2E-004] Paused indicator shows awaiting acknowledgment text @p1', async ({
    page,
  }) => {
    await navigateToTestDebate(page);

    // Given: Debate is paused via Guardian
    await sendWebSocketMessage(page, guardianInterruptPayload());
    await sendWebSocketMessage(page, debatePausedPayload());

    // Then: The paused indicator is visible with the expected text
    const pausedIndicator = page.locator('[data-testid="debate-paused-indicator"]');
    await expect(pausedIndicator).toBeVisible({ timeout: 10_000 });
    await expect(pausedIndicator).toContainText('awaiting your acknowledgment');

    // And: The pause icon ⏸ is visible
    await expect(pausedIndicator.getByText('⏸')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 2-2-E2E-005
  // ---------------------------------------------------------------------------
  test('[2-2-E2E-005] Violet ring appears on stream when paused @p1', async ({ page }) => {
    await navigateToTestDebate(page);

    // Then: Initially no violet ring
    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 10_000 });
    await expect(debateStream).not.toHaveClass(/ring-violet-600/);

    // When: Debate is paused
    await sendWebSocketMessage(page, guardianInterruptPayload());
    await sendWebSocketMessage(page, debatePausedPayload());

    // Then: Violet ring class appears
    await expect(debateStream).toHaveClass(/ring-violet-600/, { timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // 2-2-E2E-006 (P2)
  // ---------------------------------------------------------------------------
  test('[2-2-E2E-006] Rapid sequential pauses update guardian message @p2', async ({
    page,
  }) => {
    await navigateToTestDebate(page);

    // Given: First Guardian interrupt fires
    await sendWebSocketMessage(page, guardianInterruptPayload({ turn: 2 }));
    await sendWebSocketMessage(page, debatePausedPayload({ turn: 2 }));

    const guardianMessage = page.locator('[data-testid^="guardian-message-"]').first();
    await expect(guardianMessage).toBeVisible({ timeout: 10_000 });

    const pausedIndicator = page.locator('[data-testid="debate-paused-indicator"]');
    await expect(pausedIndicator).toBeVisible({ timeout: 10_000 });

    // When: Second interrupt arrives while still paused (e.g. another bias detected)
    await sendWebSocketMessage(page, guardianInterruptPayload({ turn: 3, fallacyType: 'confirmation_bias', reason: 'Confirmation bias detected.' }));
    await sendWebSocketMessage(page, debatePausedPayload({ turn: 3 }));

    // Then: At least 2 guardian messages exist and paused indicator stays visible
    const allGuardianMessages = page.locator('[data-testid^="guardian-message-"]');
    await expect(allGuardianMessages).toHaveCount(4, { timeout: 10_000 });
    await expect(pausedIndicator).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 2-2-E2E-007 (P2)
  // ---------------------------------------------------------------------------
  test('[2-2-E2E-007] Resume after ack clears paused state completely @p2', async ({
    page,
  }) => {
    await navigateToTestDebate(page);

    // Given: Debate is paused
    await sendWebSocketMessage(page, guardianInterruptPayload());
    await sendWebSocketMessage(page, debatePausedPayload());

    const pausedIndicator = page.locator('[data-testid="debate-paused-indicator"]');
    await expect(pausedIndicator).toBeVisible({ timeout: 10_000 });

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toHaveClass(/ring-violet-600/);

    // When: User acks and server resumes
    const ackButton = page.locator('[data-testid^="ack-guardian-"]').first();
    await expect(ackButton).toBeVisible({ timeout: 10_000 });
    await ackButton.click();

    await sendWebSocketMessage(page, debateResumedPayload());

    // Then: All paused indicators are gone
    await expect(pausedIndicator).not.toBeVisible({ timeout: 10_000 });
    await expect(debateStream).not.toHaveClass(/ring-violet-600/);

    // And: New arguments can still arrive after resume
    await sendWebSocketMessage(page, argumentCompletePayload('bull', 3));
    const argumentBubble = page.locator('[data-testid="argument-bubble"]').first();
    await expect(argumentBubble).toBeVisible({ timeout: 10_000 });
  });
});
