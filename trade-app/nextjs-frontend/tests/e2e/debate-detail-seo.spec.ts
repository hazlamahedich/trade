import { test, expect } from "@playwright/test";

const MOCK_EXTERNAL_ID = "deb_btc_e2etest01";

const MOCK_DEBATE_DETAIL = {
  debateId: "deb_btc_e2etest01",
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

test.describe("Debate Detail SEO Page", () => {
  test("[P0][4.3-E2E-001] given completed debate, when page loads, then <title> contains asset and site name", async ({
    page,
  }) => {
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

    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    await expect(page).toHaveTitle(/Bull vs Bear on BTC.*AI Trading Debate Lab/);
  });

  test("[P0][4.3-E2E-002] given completed debate, when page loads, then meta description is set", async ({
    page,
  }) => {
    await page.route(
      `**/api/debate/${MOCK_EXTERNAL_ID}/result**`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: MOCK_DEBATE_DETAIL,
            error: null,
            meta: {},
          }),
        }),
    );

    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    const metaDesc = page.locator('meta[name="description"]');
    await expect(metaDesc).toHaveAttribute(
      "content",
      /AI debate analysis on BTC/,
    );
  });

  test("[P0][4.3-E2E-003] given completed debate, when page loads, then Open Graph tags are present", async ({
    page,
  }) => {
    await page.route(
      `**/api/debate/${MOCK_EXTERNAL_ID}/result**`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: MOCK_DEBATE_DETAIL,
            error: null,
            meta: {},
          }),
        }),
    );

    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    await expect(
      page.locator('meta[property="og:title"]'),
    ).toHaveAttribute("content", /Bull vs Bear on BTC/);
    await expect(
      page.locator('meta[property="og:type"]'),
    ).toHaveAttribute("content", "article");
    await expect(
      page.locator('meta[property="og:url"]'),
    ).toHaveAttribute("content", `/debates/${MOCK_EXTERNAL_ID}`);
  });

  test("[P0][4.3-E2E-004] given completed debate, when page loads, then JSON-LD structured data is present and valid", async ({
    page,
  }) => {
    await page.route(
      `**/api/debate/${MOCK_EXTERNAL_ID}/result**`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: MOCK_DEBATE_DETAIL,
            error: null,
            meta: {},
          }),
        }),
    );

    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    const jsonLdScript = page.locator('script[type="application/ld+json"]');
    await expect(jsonLdScript).toBeAttached();

    const jsonLdText = await jsonLdScript.textContent();
    const parsed = JSON.parse(jsonLdText!);

    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("DiscussionForumPosting");
    expect(parsed.headline).toContain("BTC");
    expect(parsed.interactionStatistic.userInteractionCount).toBe(142);
    expect(parsed.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("[P0][4.3-E2E-005] given non-existent debate, when page loads, then 404 page is shown", async ({
    page,
  }) => {
    await page.route(
      `**/api/debate/nonexistent_id/result**`,
      (route) =>
        route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            data: null,
            error: { code: "NOT_FOUND", message: "Debate not found" },
            meta: {},
          }),
        }),
    );

    const response = await page.goto(`/debates/nonexistent_id`);

    expect(response?.status()).toBe(404);
    await expect(page.getByText("Debate Not Found")).toBeVisible();
  });

  test("[P0][4.3-E2E-006] given old dashboard URL, when navigated, then permanent redirect to /debates/[id]", async ({
    page,
  }) => {
    const response = await page.goto(
      `/dashboard/debates/${MOCK_EXTERNAL_ID}`,
    );

    expect(response?.status()).toBeGreaterThanOrEqual(300);
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(new RegExp(`/debates/${MOCK_EXTERNAL_ID}`));
  });

  test("[P1][4.3-E2E-007] given completed debate, when page loads, then above-fold content is visible", async ({
    page,
  }) => {
    await page.route(
      `**/api/debate/${MOCK_EXTERNAL_ID}/result**`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: MOCK_DEBATE_DETAIL,
            error: null,
            meta: {},
          }),
        }),
    );

    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    await expect(page.getByText("BTC")).toBeVisible();
    await expect(page.getByText("Completed Debate")).toBeVisible();
    await expect(page.getByText(/142 votes/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Watch Live Debates/ }),
    ).toBeVisible();
  });

  test("[P1][4.3-E2E-008] given completed debate with transcript, when page loads, then transcript messages render", async ({
    page,
  }) => {
    await page.route(
      `**/api/debate/${MOCK_EXTERNAL_ID}/result**`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: MOCK_DEBATE_DETAIL,
            error: null,
            meta: {},
          }),
        }),
    );

    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    await expect(page.getByText("BTC shows strong momentum")).toBeVisible();
    await expect(
      page.getByText("Resistance at 70k is significant"),
    ).toBeVisible();
  });

  test("[P1][4.3-E2E-009] given completed debate, when page loads, then CTA links to home page", async ({
    page,
  }) => {
    await page.route(
      `**/api/debate/${MOCK_EXTERNAL_ID}/result**`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: MOCK_DEBATE_DETAIL,
            error: null,
            meta: {},
          }),
        }),
    );

    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    const cta = page.getByRole("link", { name: /Watch Live Debates/ });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/");
  });

  test("[P1][4.3-E2E-010] given completed debate, when page loads, then back link navigates to debate history", async ({
    page,
  }) => {
    await page.route(
      `**/api/debate/${MOCK_EXTERNAL_ID}/result**`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: MOCK_DEBATE_DETAIL,
            error: null,
            meta: {},
          }),
        }),
    );

    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    const backLink = page.getByRole("link", {
      name: /Back to Debate History/,
    });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute("href", "/dashboard/debates");
  });

  test("[P1][4.3-E2E-011] given completed debate, when mobile viewport, then page renders single column", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.route(
      `**/api/debate/${MOCK_EXTERNAL_ID}/result**`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: MOCK_DEBATE_DETAIL,
            error: null,
            meta: {},
          }),
        }),
    );

    await page.goto(`/debates/${MOCK_EXTERNAL_ID}`);

    await expect(page.getByText("BTC")).toBeVisible();
    await expect(page.getByText("Completed Debate")).toBeVisible();

    const main = page.locator("main");
    const box = await main.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(375);
  });
});
