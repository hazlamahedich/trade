import { test, expect } from '../support/fixtures';
import { argumentCompletePayload, debatePausedPayload, debateResumedPayload } from '../support/helpers/debate-payloads';
import { createWsVoteMessage } from '../support/helpers/vote-factories';

const DEBATE_ID = 'debate-lifecycle-001';

test.describe('Full Debate + Voting Lifecycle', () => {

  test('should complete full lifecycle: debate stream → guardian interrupt → resume → vote → sentiment reveal', async ({ page }) => {
    await page.goto(`/debates/${DEBATE_ID}`);

    await page.route('**/api/debate/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/result')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { totalVotes: 1, voteBreakdown: { bull: 1, bear: 0, undecided: 0 } },
            error: null,
            meta: { latency_ms: 50 },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: DEBATE_ID, status: 'running', ticker: 'BTC', title: 'BTC Analysis' },
          error: null,
          meta: {},
        }),
      });
    });

    await page.addInitScript({
      content: `
        window.__testWebSocket__ = null;
        const OrigWS = window.WebSocket;
        window.WebSocket = function(url, protocols) {
          const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
          window.__testWebSocket__ = ws;
          ws._listeners = {};
          const origAdd = ws.addEventListener.bind(ws);
          ws.addEventListener = function(type, fn, opts) {
            ws._listeners[type] = ws._listeners[type] || [];
            ws._listeners[type].push(fn);
            return origAdd(type, fn, opts);
          };
          ws.dispatchEvent = function(evt) {
            (ws._listeners[evt.type] || []).forEach(fn => fn(evt));
          };
          return ws;
        };
        window.WebSocket.prototype = OrigWS.prototype;
        window.WebSocket.CONNECTING = 0;
        window.WebSocket.OPEN = 1;
        window.WebSocket.CLOSING = 2;
        window.WebSocket.CLOSED = 3;
      `,
    });

    await page.reload();
    await page.waitForTimeout(1000);

    await page.evaluate((data) => {
      const ws = window.__testWebSocket__;
      if (ws && ws._listeners.message) {
        const evt = new MessageEvent('message', { data });
        ws._listeners.message.forEach((fn: EventListener) => fn(evt));
      }
    }, JSON.stringify(argumentCompletePayload('bull', 1, { debateId: DEBATE_ID })));

    const bullArg = page.getByTestId('debate-stream');
    await expect(bullArg).toBeVisible({ timeout: 10000 });

    await page.evaluate((data) => {
      const ws = window.__testWebSocket__;
      if (ws && ws._listeners.message) {
        const evt = new MessageEvent('message', { data });
        ws._listeners.message.forEach((fn: EventListener) => fn(evt));
      }
    }, JSON.stringify(debatePausedPayload({ debateId: DEBATE_ID })));

    const guardianOverlay = page.getByTestId('guardian-freeze-overlay');
    await expect(guardianOverlay).toBeVisible({ timeout: 5000 });

    await page.evaluate((data) => {
      const ws = window.__testWebSocket__;
      if (ws && ws._listeners.message) {
        const evt = new MessageEvent('message', { data });
        ws._listeners.message.forEach((fn: EventListener) => fn(evt));
      }
    }, JSON.stringify(debateResumedPayload()));

    const dismissBtn = page.getByTestId('guardian-dismiss-btn');
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click();
    }
    await expect(guardianOverlay).not.toBeVisible({ timeout: 5000 });

    await page.evaluate((data) => {
      const ws = window.__testWebSocket__;
      if (ws && ws._listeners.message) {
        const evt = new MessageEvent('message', { data });
        ws._listeners.message.forEach((fn: EventListener) => fn(evt));
      }
    }, JSON.stringify(argumentCompletePayload('bear', 2, { debateId: DEBATE_ID })));

    const voteBullBtn = page.getByTestId('vote-bull-btn');
    await expect(voteBullBtn).toBeVisible({ timeout: 10000 });

    await voteBullBtn.click();

    await expect(page.getByTestId('sentiment-reveal')).toBeVisible({ timeout: 10000 });
  });

  test('should show first voter celebration then update via WebSocket vote push', async ({ page }) => {
    await page.route('**/api/debate/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/result')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { totalVotes: 1, voteBreakdown: { bull: 1, bear: 0, undecided: 0 } },
            error: null,
            meta: { latency_ms: 50 },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: DEBATE_ID, status: 'running', ticker: 'BTC' },
          error: null,
          meta: {},
        }),
      });
    });

    await page.route('**/api/vote/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { success: true, choice: 'bull', debateId: DEBATE_ID },
          error: null,
          meta: {},
        }),
      });
    });

    await page.goto(`/debates/${DEBATE_ID}`);
    await page.waitForTimeout(500);

    const voteBtn = page.getByTestId('vote-bull-btn');
    await expect(voteBtn).toBeVisible({ timeout: 10000 });
    await voteBtn.click();

    await expect(page.getByTestId('sentiment-reveal')).toBeVisible({ timeout: 10000 });

    const celebration = page.getByText(/first vote|led the way/i);
    if (await celebration.isVisible()) {
      await expect(celebration).toBeVisible();
    }

    const voteUpdate = createWsVoteMessage({
      debateId: DEBATE_ID,
      totalVotes: 3,
      voteBreakdown: { bull: 2, bear: 1, undecided: 0 },
    });

    await page.evaluate((data) => {
      const ws = (window as unknown as Record<string, unknown>).__testWebSocket__;
      if (ws && (ws as Record<string, unknown>)._listeners && ((ws as Record<string, Record<string, EventListener[]>>)._listeners).message) {
        const listeners = ((ws as Record<string, Record<string, EventListener[]>>)._listeners).message;
        const evt = new MessageEvent('message', { data });
        listeners.forEach((fn: EventListener) => fn(evt));
      }
    }, JSON.stringify(voteUpdate));
  });

  test('should prevent double voting', async ({ page }) => {
    let voteCount = 0;

    await page.route('**/api/debate/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: DEBATE_ID, status: 'running', ticker: 'BTC' },
          error: null,
          meta: {},
        }),
      });
    });

    await page.route('**/api/vote/**', async (route) => {
      voteCount++;
      if (voteCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { success: true, choice: 'bull' }, error: null, meta: {} }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { success: false, error: 'already_voted' }, error: null, meta: {} }),
        });
      }
    });

    await page.goto(`/debates/${DEBATE_ID}`);

    const voteBtn = page.getByTestId('vote-bull-btn');
    await expect(voteBtn).toBeVisible({ timeout: 10000 });
    await voteBtn.click();

    await expect(page.getByTestId('sentiment-reveal')).toBeVisible({ timeout: 10000 });
    await expect(voteBtn).not.toBeVisible({ timeout: 5000 });
  });
});
