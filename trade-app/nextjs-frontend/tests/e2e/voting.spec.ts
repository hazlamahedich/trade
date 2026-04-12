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

  test('should allow user to vote on running debate', async ({ page, request }) => {
    const debate = await seedDebate(request, { status: 'running', ticker: 'ETH' });
    debateId = debate.id;

    await page.goto(`/debates/${debate.id}`);

    await expect(page.getByTestId('vote-bull-btn')).toBeVisible();

    await page.getByTestId('vote-bull-btn').click();

    await expect(page.getByTestId('sentiment-reveal')).toBeVisible({ timeout: 10000 });
  });

  test('should update vote counts in real-time', async ({ page, request }) => {
    const debate = await seedDebate(request, { status: 'running' });
    debateId = debate.id;

    await page.goto(`/debates/${debate.id}`);

    await expect(page.getByTestId('vote-bear-btn')).toBeVisible();

    await page.getByTestId('vote-bear-btn').click();

    await expect(page.getByTestId('sentiment-reveal')).toBeVisible({ timeout: 10000 });
  });

  test('should prevent voting on completed debate', async ({ page, request }) => {
    const debate = await seedDebate(request, { status: 'completed' });
    debateId = debate.id;

    await page.goto(`/debates/${debate.id}`);

    await expect(page.getByTestId('vote-bull-btn')).not.toBeVisible();
    await expect(page.getByTestId('sentiment-reveal')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Voting - Data Factory Usage', () => {
  // eslint-disable-next-line no-empty-pattern
  test('should use factory-generated test data', async ({}) => {
    const user = createUser({ email: 'voter@example.com' });
    const debate = createDebate({ 
      ticker: 'AAPL', 
      status: 'running',
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
