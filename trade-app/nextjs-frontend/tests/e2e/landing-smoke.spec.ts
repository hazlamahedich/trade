import { test, expect } from "@playwright/test";

test.describe("[4.4-E2E-001] Landing page smoke test", () => {
  test("page loads and hero renders", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toContainText("Watch AI Agents Debate Your Next Trade");
  });

  test("CTA navigates to /debates", async ({ page }) => {
    await page.goto("/");

    const cta = page.getByRole("link", { name: /see it in action/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/debates");
  });

  test("metadata present in <head>", async ({ page }) => {
    await page.goto("/");

    const title = await page.title();
    expect(title).toContain("AI Trading Debate");

    const description = await page.getAttribute('meta[name="description"]', "content");
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(10);

    const ogTitle = await page.getAttribute('meta[property="og:title"]', "content");
    expect(ogTitle).toContain("AI Trading Debate");

    const twitterCard = await page.getAttribute('meta[name="twitter:card"]', "content");
    expect(twitterCard).toBe("summary_large_image");
  });

  test("skip-to-content link exists", async ({ page }) => {
    await page.goto("/");

    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });

  test("disclaimer banner is visible", async ({ page }) => {
    await page.goto("/");

    const disclaimer = page.getByText(/not financial advice/i);
    await expect(disclaimer).toBeVisible();
  });
});
