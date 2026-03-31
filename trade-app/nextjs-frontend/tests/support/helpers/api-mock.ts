import { type Page } from '@playwright/test';

export const MOCK_DEBATE_RESPONSE = {
  data: {
    debateId: 'mock-debate-123',
    asset: 'BTC',
    status: 'running',
    messages: [],
    currentTurn: 0,
    maxTurns: 6,
    createdAt: new Date().toISOString(),
  },
  error: null,
  meta: { latencyMs: 50 },
};

export const MOCK_MARKET_DATA = {
  data: {
    symbol: 'BTC',
    price: 67432.5,
    change24h: 2.34,
    volume24h: 28_500_000_000,
    marketCap: 1_320_000_000_000,
    high24h: 68_100.0,
    low24h: 65_800.0,
    sparkline: Array.from({ length: 24 }, () => 65_000 + Math.random() * 3000),
  },
  error: null,
  meta: { latencyMs: 30 },
};

const MOCK_AUTH_USER = {
  id: 'mock-user-001',
  email: 'mock@test.com',
  name: 'Mock User',
  role: 'analyst',
  createdAt: new Date().toISOString(),
  isActive: true,
};

const MOCK_AUTH_RESPONSE = {
  data: {
    user: MOCK_AUTH_USER,
    token: 'mock-jwt-token-xyz',
    refreshToken: 'mock-refresh-token-xyz',
  },
  error: null,
  meta: { latencyMs: 20 },
};

const MOCK_DEBATE_START_RESPONSE = {
  data: {
    debateId: 'mock-debate-123',
    asset: 'BTC',
    status: 'running',
    messages: [],
    currentTurn: 0,
    maxTurns: 6,
    createdAt: new Date().toISOString(),
  },
  error: null,
  meta: { latencyMs: 50 },
};

export async function setupApiMocks(page: Page): Promise<void> {
  await page.route('**/api/debate/start', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DEBATE_START_RESPONSE),
    });
  });

  await page.route('**/api/debate/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          debateId: 'mock-debate-123',
          asset: 'BTC',
          status: 'completed',
          messages: [
            {
              id: 'msg-1',
              role: 'bull',
              content: 'Strong bullish momentum with increasing volume and positive MACD crossover.',
              timestamp: new Date(Date.now() - 60000).toISOString(),
            },
            {
              id: 'msg-2',
              role: 'bear',
              content: 'RSI indicates overbought conditions and resistance at current levels.',
              timestamp: new Date(Date.now() - 30000).toISOString(),
            },
          ],
          currentTurn: 1,
          maxTurns: 6,
          createdAt: new Date(Date.now() - 120000).toISOString(),
        },
        error: null,
        meta: { latencyMs: 40 },
      }),
    });
  });

  await page.route('**/api/market/**', async (route) => {
    const url = route.request().url();
    const symbolMatch = url.match(/\/api\/market\/([^/?]+)/);
    const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : 'BTC';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...MOCK_MARKET_DATA,
        data: {
          ...MOCK_MARKET_DATA.data,
          symbol,
        },
      }),
    });
  });

  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_AUTH_RESPONSE),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: MOCK_AUTH_USER,
        error: null,
        meta: { latencyMs: 10 },
      }),
    });
  });

  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          token: 'mock-jwt-token-refreshed',
          refreshToken: 'mock-refresh-token-refreshed',
        },
        error: null,
        meta: { latencyMs: 15 },
      }),
    });
  });

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: null,
        error: null,
        meta: { latencyMs: 5 },
      }),
    });
  });
}
