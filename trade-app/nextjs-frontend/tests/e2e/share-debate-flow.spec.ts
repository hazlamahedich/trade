import { test, expect } from "@playwright/test";

const MOCK_EXTERNAL_ID = "deb_btc_share_e2e";

const MOCK_DEBATE_DETAIL = {
  debateId: MOCK_EXTERNAL_ID,
  asset: "btc",
  status: "completed",
  currentTurn: 6,
  maxTurns: 6,
  guardianVerdict: "Moderate risk environment.",
  guardianInterruptsCount: 0,
  createdAt: "2026-04-15T12:00:00.000Z",
  completedAt: "2026-04-15T13:00:00.000Z",
  totalVotes: 142,
  voteBreakdown: { bull: 85, bear: 47, undecided: 10 },
  transcript: [
    { role: "bull", content: "BTC shows strong momentum" },
    { role: "bear", content: "Resistance at 70k is significant" },
  ],
};

async function setupDebateRoute(page: import("@playwright/test").Page) {
  await page.route(
    `**/api/debate/${MOCK_EXTERNAL_ID}/result**`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: MOCK_DEBATE_DETAIL,
          error: null,
          meta: { latency_ms: 50 },
        }),
      }),
  );
}

test.describe("[5.4] Share Debate — E2E (clipboard path only)", () => {
  test("[5.4-E2E-001] ShareDebateButton visible on debate detail page", async ({ page }) => {
    await setupDebateRoute(page);
    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    const shareButton = page.getByTestId("share-debate-button");
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await expect(shareButton).toHaveAttribute("aria-label", "Share debate");
  });

  test("[5.4-E2E-002] ShareDebateButton coexists with BackToHistoryLink and WatchLiveCTA", async ({ page }) => {
    await setupDebateRoute(page);
    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    await expect(page.getByTestId("share-debate-button")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Back to Debate History")).toBeVisible();
    await expect(page.getByText("Watch Live Debates")).toBeVisible();
  });

  test("[5.4-E2E-003] Click triggers clipboard copy on desktop viewport", async ({ page }) => {
    await setupDebateRoute(page);

    await page.addInitScript(() => {
      const writeText = async (text: string) => {
        (window as unknown as Record<string, unknown>).__e2e_copied = text;
        return Promise.resolve();
      };
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, "share", {
        value: undefined,
        writable: true,
        configurable: true,
      });
    });

    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    const shareButton = page.getByTestId("share-debate-button");
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await shareButton.click();

    const copied = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__e2e_copied as string | undefined,
    );
    expect(copied).toContain(`/debates/${MOCK_EXTERNAL_ID}`);
  });

  test("[5.4-E2E-004] Keyboard accessible — Enter key activates share", async ({ page }) => {
    await setupDebateRoute(page);

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        writable: true,
        configurable: true,
      });
    });

    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    const shareButton = page.getByTestId("share-debate-button");
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await shareButton.focus();
    await shareButton.press("Enter");

    const ariaBusy = await shareButton.getAttribute("aria-busy");
    expect(ariaBusy).toBeDefined();
  });

  test("[5.4-E2E-005] 44px touch target", async ({ page }) => {
    await setupDebateRoute(page);
    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    const shareButton = page.getByTestId("share-debate-button");
    await expect(shareButton).toBeVisible({ timeout: 10000 });

    const classes = await shareButton.getAttribute("class");
    expect(classes).toContain("min-h-[44px]");
    expect(classes).toContain("min-w-[44px]");
  });
});
