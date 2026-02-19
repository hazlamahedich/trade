import { test, expect } from '../support/fixtures';
import { createUser, createDebate } from '../support/factories';
import { seedDebate, cleanupDebate } from '../support/helpers/seed-helpers';

test.describe('Voting System', () => {
  let debateId: string;

  test.afterEach(async ({ request }) => {
    if (debateId) {
      await cleanupDebate(request, debateId);
    }
  });

  test('should allow user to vote on active debate', async ({ page, request }) => {
    const debate = await seedDebate(request, { status: 'active', ticker: 'ETH' });
    debateId = debate.id;

    await page.goto(`/debates/${debate.id}`);

    await expect(page.getByTestId('voting-panel')).toBeVisible();

    await page.click('[data-testid="vote-bull-btn"]');

    await expect(page.getByTestId('vote-confirmation')).toBeVisible();
    await expect(page.getByTestId('bull-vote-count')).toContainText(/\d+/);
  });

  test('should update vote counts in real-time', async ({ page, request }) => {
    const debate = await seedDebate(request, { status: 'active' });
    debateId = debate.id;

    await page.goto(`/debates/${debate.id}`);

    const initialBearVotes = await page.getByTestId('bear-vote-count').textContent();

    await page.click('[data-testid="vote-bear-btn"]');

    await page.waitForFunction(
      (initial: string) => {
        const current = document.querySelector('[data-testid="bear-vote-count"]')?.textContent;
        return current !== initial;
      },
      initialBearVotes ?? '',
      { timeout: 10000 }
    );
  });

  test('should prevent voting on completed debate', async ({ page, request }) => {
    const debate = await seedDebate(request, { status: 'completed' });
    debateId = debate.id;

    await page.goto(`/debates/${debate.id}`);

    await expect(page.getByTestId('voting-panel')).not.toBeVisible();
    await expect(page.getByTestId('debate-results')).toBeVisible();
  });

  test('should show user vote history', async ({ page }) => {
    await page.goto('/profile/votes');

    await expect(page.getByTestId('vote-history')).toBeVisible();

    const voteCards = page.locator('[data-testid="vote-card"]');
    await expect(voteCards.first()).toBeVisible();
  });
});

test.describe('Voting - Data Factory Usage', () => {
  // eslint-disable-next-line no-empty-pattern
  test('should use factory-generated test data', async ({}) => {
    const user = createUser({ email: 'voter@example.com' });
    const debate = createDebate({ 
      ticker: 'AAPL', 
      status: 'active',
      participants: {
        bull: { confidence: 85, arguments: ['Strong earnings'] },
        bear: { confidence: 45, arguments: ['Market saturation'] },
        guardian: { riskLevel: 'medium', warnings: ['High volatility'] },
      },
    });

    expect(user.email).toBe('voter@example.com');
    expect(debate.ticker).toBe('AAPL');
    expect(debate.participants.bull.confidence).toBe(85);
  });
});
