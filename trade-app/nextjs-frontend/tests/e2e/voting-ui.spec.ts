import { test, expect } from '../support/fixtures';

const DEBATE_ID = 'test-debate-voting';

const MOCK_DEBATE_RUNNING = {
  data: {
    debateId: DEBATE_ID,
    asset: 'BTC',
    status: 'running',
    currentTurn: 3,
    maxTurns: 6,
    guardianVerdict: null,
    guardianInterruptsCount: 0,
    createdAt: new Date(Date.now() - 120000).toISOString(),
    completedAt: null,
    totalVotes: 0,
    voteBreakdown: {},
  },
  error: null,
  meta: {},
};

const MOCK_VOTE_SUCCESS = {
  data: {
    voteId: 'vote-001',
    debateId: DEBATE_ID,
    choice: 'bull',
    voterFingerprint: 'e2e-fingerprint',
    createdAt: new Date().toISOString(),
  },
  error: null,
  meta: { latencyMs: 50, isFinal: true },
};

const MOCK_DEBATE_RESULT_AFTER_VOTE = {
  data: {
    ...MOCK_DEBATE_RUNNING.data,
    totalVotes: 1,
    voteBreakdown: { bull: 1, bear: 0 },
  },
  error: null,
  meta: {},
};

async function setupRunningDebate(page: import('@playwright/test').Page) {
  await page.route('**/api/debate/*/result', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DEBATE_RUNNING),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { id: 'user-1', email: 'test@test.com', name: 'Test', role: 'user', createdAt: new Date().toISOString(), isActive: true },
        error: null,
        meta: {},
      }),
    });
  });
}

test.describe('[3-2-E2E] Voting UI Components', () => {
  test('[3-2-E2E-01] AC1: Optimistic UI update — vote button updates immediately @p0', async ({ page }) => {
    await setupRunningDebate(page);

    let voteCalled = false;
    await page.route('**/api/debate/vote', async (route) => {
      voteCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_VOTE_SUCCESS),
      });
    });

    await page.goto(`/debates/${DEBATE_ID}`);
    await expect(page.getByTestId('vote-bull-btn')).toBeVisible();

    await page.click('[data-testid="vote-bull-btn"]');

    await expect(page.getByTestId('vote-bull-btn')).toBeDisabled();

    expect(voteCalled).toBe(true);
  });

  test('[3-2-E2E-02] AC2: Sentiment reveal appears after vote confirmed @p0', async ({ page }) => {
    await setupRunningDebate(page);

    await page.route('**/api/debate/vote', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_VOTE_SUCCESS),
      });
    });

    await page.route('**/api/debate/*/result', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DEBATE_RESULT_AFTER_VOTE),
      });
    });

    await page.goto(`/debates/${DEBATE_ID}`);
    await expect(page.getByTestId('vote-bull-btn')).toBeVisible();

    await page.click('[data-testid="vote-bull-btn"]');

    await expect(page.getByTestId('sentiment-reveal')).toBeVisible({ timeout: 10000 });
  });

  test('[3-2-E2E-03] AC3: Rollback on API failure — vote buttons re-enabled @p0', async ({ page }) => {
    await setupRunningDebate(page);

    await page.route('**/api/debate/vote', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          error: { code: 'RATE_LIMITED', message: 'Too many votes' },
          meta: { retryAfterMs: 5000 },
        }),
      });
    });

    await page.goto(`/debates/${DEBATE_ID}`);
    await expect(page.getByTestId('vote-bull-btn')).toBeVisible();

    await page.click('[data-testid="vote-bull-btn"]');

    await expect(page.getByTestId('vote-bull-btn')).toBeEnabled({ timeout: 10000 });
    await expect(page.getByTestId('vote-bear-btn')).toBeEnabled({ timeout: 10000 });
  });

  test('[3-2-E2E-04] AC4: Already voted state — shows SentimentReveal on return @p0', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('vote:test-debate-voting', JSON.stringify({
        choice: 'bull',
        timestamp: new Date().toISOString(),
      }));
      sessionStorage.setItem('voter_fingerprint', 'e2e-fingerprint');
    });

    await page.route('**/api/debate/*/result', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DEBATE_RESULT_AFTER_VOTE),
      });
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'user-1', email: 'test@test.com', name: 'Test', role: 'user', createdAt: new Date().toISOString(), isActive: true },
          error: null,
          meta: {},
        }),
      });
    });

    await page.goto(`/debates/${DEBATE_ID}`);

    await expect(page.getByTestId('sentiment-reveal')).toBeVisible({ timeout: 10000 });
  });

  test('[3-2-E2E-05] AC5: Guardian freeze disables vote buttons @p0', async ({ page }) => {
    await setupRunningDebate(page);

    await page.addInitScript(() => {
      const origWS = window.WebSocket;
      class FreezeWebSocket extends origWS {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
            setTimeout(() => {
              if (this.onmessage) {
                this.onmessage({
                  data: JSON.stringify({
                    type: 'DEBATE/GUARDIAN_INTERRUPT',
                    payload: {
                      debateId: 'test-debate-voting',
                      riskLevel: 'high',
                      reason: 'Detected overconfidence bias',
                      safe: false,
                    },
                    timestamp: new Date().toISOString(),
                  }),
                } as MessageEvent);
              }
            }, 300);
          }, 50);
        }
      }
      window.WebSocket = FreezeWebSocket as typeof WebSocket;
    });

    await page.goto(`/debates/${DEBATE_ID}`);
    await expect(page.getByTestId('vote-bull-btn')).toBeVisible();

    await expect(page.getByText('Voting paused during risk review')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('vote-bull-btn')).toBeDisabled();
    await expect(page.getByTestId('vote-bear-btn')).toBeDisabled();
  });

  test('[3-2-E2E-06] Vote Bear triggers correct API call @p1', async ({ page }) => {
    await setupRunningDebate(page);

    await page.route('**/api/debate/vote', async (route) => {
      const body = route.request().postDataJSON();
      expect(body.choice).toBe('bear');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_VOTE_SUCCESS,
          data: { ...MOCK_VOTE_SUCCESS.data, choice: 'bear' },
        }),
      });
    });

    await page.goto(`/debates/${DEBATE_ID}`);
    await expect(page.getByTestId('vote-bear-btn')).toBeVisible();

    await page.click('[data-testid="vote-bear-btn"]');
    await expect(page.getByTestId('sentiment-reveal')).toBeVisible({ timeout: 10000 });
  });

  test('[3-2-E2E-07] 503 VOTING_DISABLED shows error toast @p1', async ({ page }) => {
    await setupRunningDebate(page);

    await page.route('**/api/debate/vote', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          error: { code: 'VOTING_DISABLED', message: 'Voting disabled' },
          meta: { estimatedWaitMs: 10000 },
        }),
      });
    });

    await page.goto(`/debates/${DEBATE_ID}`);
    await expect(page.getByTestId('vote-bull-btn')).toBeVisible();

    await page.click('[data-testid="vote-bull-btn"]');

    await expect(page.getByText(/temporarily unavailable/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('vote-bull-btn')).toBeEnabled({ timeout: 10000 });
  });
});
