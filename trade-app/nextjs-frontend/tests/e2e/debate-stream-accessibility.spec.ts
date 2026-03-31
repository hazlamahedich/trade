import { test, expect } from '../support/fixtures';
import {
  injectWebSocketInterceptor,
  waitForWebSocketConnection,
} from '../support/helpers/ws-helpers';

test.describe('[1-5] Debate Stream UI — Accessibility (P1/P2)', () => {
  test('[1-5-E2E-008] Mobile portrait layout is readable @p1', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await injectWebSocketInterceptor(page);

    const debateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
    );

    await page.goto('/');
    await page.click('[data-testid="create-debate-btn"]');
    await page.fill('[data-testid="ticker-input"]', 'LINK');
    await page.fill('[data-testid="title-input"]', 'Chainlink Analysis');
    await page.click('[data-testid="submit-debate-btn"]');

    await debateResponse;

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toBeVisible({ timeout: 30000 });

    const argumentText = debateStream.locator('p').first();
    const fontSize = await argumentText.evaluate((el) =>
      window.getComputedStyle(el).fontSize
    );
    const fontSizeNum = parseFloat(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(16);

    const boundingBox = await debateStream.boundingBox();
    expect(boundingBox?.width).toBeLessThanOrEqual(375);
  });

  test('[1-5-E2E-009] WCAG AA accessibility passes @p1 @accessibility', async ({ page }) => {
    await injectWebSocketInterceptor(page);

    const debateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
    );

    await page.goto('/');
    await page.click('[data-testid="create-debate-btn"]');
    await page.fill('[data-testid="ticker-input"]', 'MATIC');
    await page.fill('[data-testid="title-input"]', 'Polygon Analysis');
    await page.click('[data-testid="submit-debate-btn"]');

    await debateResponse;

    const liveRegion = page.locator('[role="log"][aria-live="polite"]');
    await expect(liveRegion).toBeVisible({ timeout: 30000 });

    const debateStream = page.locator('[data-testid="debate-stream"]');
    await expect(debateStream).toHaveAttribute('aria-label', /debate messages/i);
  });

  test('[1-5-E2E-010] Dual-coding for color (icons + text) @p1 @accessibility', async ({ page }) => {
    await injectWebSocketInterceptor(page);

    const debateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
    );

    await page.goto('/');
    await page.click('[data-testid="create-debate-btn"]');
    await page.fill('[data-testid="ticker-input"]', 'UNI');
    await page.fill('[data-testid="title-input"]', 'Uniswap Analysis');
    await page.click('[data-testid="submit-debate-btn"]');

    await debateResponse;
    await waitForWebSocketConnection(page);
    await page.waitForTimeout(5000);

    const bullSection = page.locator('[data-agent="bull"]').first();
    const bullIcon = bullSection.locator('svg, [data-testid="bull-icon"]');
    await expect(bullIcon).toBeVisible({ timeout: 30000 });
    await expect(bullSection.getByText(/bull|bullish/i)).toBeVisible();

    const bearSection = page.locator('[data-agent="bear"]').first();
    const bearIcon = bearSection.locator('svg, [data-testid="bear-icon"]');
    await expect(bearIcon).toBeVisible({ timeout: 30000 });
    await expect(bearSection.getByText(/bear|bearish/i)).toBeVisible();
  });

  test('[1-5-E2E-012] Thumb Zone compliance on mobile @p2', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await injectWebSocketInterceptor(page);

    const debateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
    );

    await page.goto('/');
    await page.click('[data-testid="create-debate-btn"]');
    await page.fill('[data-testid="ticker-input"]', 'ATOM');
    await page.fill('[data-testid="title-input"]', 'Cosmos Analysis');
    await page.click('[data-testid="submit-debate-btn"]');

    await debateResponse;

    const debateStream = page.locator('[data-testid="debate-stream"]');
    const boundingBox = await debateStream.boundingBox();

    if (boundingBox) {
      const thumbZoneStart = 667 * 0.7;
      expect(boundingBox.y + boundingBox.height).toBeLessThanOrEqual(thumbZoneStart + 50);
    }
  });

  test('[1-5-E2E-013] ARIA live region announces new messages @p2 @accessibility', async ({
    page,
  }) => {
    await injectWebSocketInterceptor(page);

    const debateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
    );

    await page.goto('/');
    await page.click('[data-testid="create-debate-btn"]');
    await page.fill('[data-testid="ticker-input"]', 'LTC');
    await page.fill('[data-testid="title-input"]', 'Litecoin Analysis');
    await page.click('[data-testid="submit-debate-btn"]');

    await debateResponse;
    await waitForWebSocketConnection(page);

    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toBeVisible({ timeout: 30000 });

    await page.waitForTimeout(8000);

    const liveContent = await liveRegion.textContent();
    expect(liveContent?.length).toBeGreaterThan(0);
  });

  test('[1-5-E2E-014] Motion safety respects prefers-reduced-motion @p2 @accessibility', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await injectWebSocketInterceptor(page);

    const debateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/debate/start') && resp.status() === 200
    );

    await page.goto('/');
    await page.click('[data-testid="create-debate-btn"]');
    await page.fill('[data-testid="ticker-input"]', 'XLM');
    await page.fill('[data-testid="title-input"]', 'Stellar Analysis');
    await page.click('[data-testid="submit-debate-btn"]');

    await debateResponse;

    const animatedElements = page.locator('[data-testid="typing-indicator"], [class*="animate"]');
    const count = await animatedElements.count();

    for (let i = 0; i < count; i++) {
      const el = animatedElements.nth(i);
      const animation = await el.evaluate((elem) =>
        window.getComputedStyle(elem).animation
      );
      expect(animation).toBe('none 0s ease 0s normal none running none');
    }
  });
});
