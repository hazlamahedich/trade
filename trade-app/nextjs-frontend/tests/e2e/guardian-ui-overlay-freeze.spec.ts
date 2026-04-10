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

test.describe('[2-3] Guardian UI Overlay — The Freeze', () => {
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

  test('[2-3-E2E-001] Visual freeze — grayscale + overlay with correct content @p0 @smoke', async ({
    page,
  }) => {
    await navigateToTestDebate(page);

    await sendWebSocketMessage(page, argumentCompletePayload('bull', 1));
    await sendWebSocketMessage(page, argumentCompletePayload('bear', 2));

    await sendWebSocketMessage(page, guardianInterruptPayload());
    await sendWebSocketMessage(page, debatePausedPayload());

    const overlay = page.locator('[data-testid="guardian-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    await expect(overlay.getByText('High Risk')).toBeVisible({ timeout: 5_000 });
    await expect(
      overlay.getByText(/Detected anchoring bias in bull argument/),
    ).toBeVisible();

    const fallacyBadge = page.locator('[data-testid="guardian-fallacy-badge"]');
    await expect(fallacyBadge).toBeVisible();
    await expect(fallacyBadge).toContainText('anchoring_bias');

    const debateStream = page.locator('[data-testid="debate-stream"]');
    const filterValue = await debateStream.evaluate((el) => {
      return (el as HTMLElement).style.filter;
    });
    expect(filterValue).toContain('grayscale(60%)');

    const understandBtn = page.locator('[data-testid="guardian-understand-btn"]');
    await expect(understandBtn).toBeVisible();
    const ignoreBtn = page.locator('[data-testid="guardian-ignore-btn"]');
    await expect(ignoreBtn).toBeVisible();
  });

  test('[2-3-E2E-002] Click-outside and Escape blocking for critical @p0', async ({ page }) => {
    await navigateToTestDebate(page);

    await sendWebSocketMessage(page, argumentCompletePayload('bull', 1));
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

    await expect(page.locator('[data-testid="guardian-understand-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="guardian-ignore-btn"]')).not.toBeVisible();

    await expect(
      overlay.getByText('Critical risk detected — debate ended'),
    ).toBeVisible();

    await page.mouse.click(10, 10);
    await expect(overlay).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(overlay).toBeVisible({ timeout: 3_000 });

    const debateStream = page.locator('[data-testid="debate-stream"]');
    const filterAfterEscape = await debateStream.evaluate(
      (el) => (el as HTMLElement).style.filter,
    );
    expect(filterAfterEscape).toContain('grayscale(60%)');
  });

  test('[2-3-E2E-003] Full interrupt → acknowledge flow via WebSocket @p0', async ({ page }) => {
    await navigateToTestDebate(page);

    await sendWebSocketMessage(page, argumentCompletePayload('bull', 1));
    await sendWebSocketMessage(page, argumentCompletePayload('bear', 2));

    await sendWebSocketMessage(page, guardianInterruptPayload());
    await sendWebSocketMessage(page, debatePausedPayload());

    const overlay = page.locator('[data-testid="guardian-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    const debateStream = page.locator('[data-testid="debate-stream"]');
    const frozenFilter = await debateStream.evaluate(
      (el) => (el as HTMLElement).style.filter,
    );
    expect(frozenFilter).toContain('grayscale(60%)');

    const understandBtn = page.locator('[data-testid="guardian-understand-btn"]');
    await expect(understandBtn).toBeVisible();
    await understandBtn.click();

    await sendWebSocketMessage(page, debateResumedPayload());

    await expect(overlay).not.toBeVisible({ timeout: 10_000 });

    const unfrozenFilter = await debateStream.evaluate(
      (el) => (el as HTMLElement).style.filter,
    );
    expect(unfrozenFilter).toBe('none');

    await sendWebSocketMessage(page, argumentCompletePayload('bull', 3));
    const argumentBubble = page.locator('[data-testid="argument-bubble"]').first();
    await expect(argumentBubble).toBeVisible({ timeout: 10_000 });
  });
});
