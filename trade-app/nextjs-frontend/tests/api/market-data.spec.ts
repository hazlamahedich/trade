import { test, expect } from '@playwright/test';

/**
 * Mock Headers for Testing Failure Scenarios:
 *
 * These headers simulate backend failure conditions for testing error handling.
 * They must be implemented in FastAPI backend middleware.
 *
 * - X-Mock-Providers-Down: Simulates all external providers (CoinGecko, Yahoo) being unavailable.
 *   Backend should return cached data with isStale=true if available.
 * - X-Mock-All-Down: Simulates complete provider failure with cache bypass.
 *   Backend should return 503 MARKET_DATA_UNAVAILABLE.
 * - X-Mock-No-Cache: Bypasses Redis cache to test fresh data fetching.
 *
 * @see trade-app/fastapi_backend/app/middleware/mock_middleware.py (if implemented)
 */
const API_BASE = '/api/market';

test.describe('[1-2] Market Data API Tests', () => {
  test.describe('[P0] Critical Path', () => {
    test('[1-2-API-001] GET /api/market/{asset}/data returns valid response @p0', async ({ request }) => {
      const response = await request.get(`${API_BASE}/bitcoin/data`);

      expect(response.status()).toBe(200);

      const json = await response.json();

      expect(json.data).toBeDefined();
      expect(json.data.asset).toBe('bitcoin');
      expect(json.data.price).toBeGreaterThan(0);
      expect(json.data.currency).toBe('usd');
      expect(json.data.fetchedAt).toBeDefined();
      expect(json.error).toBeNull();
      expect(json.meta).toBeDefined();
      expect(json.meta.latencyMs).toBeDefined();
    });

    test('[1-2-API-002] Market data response matches Standard Response Envelope @p0', async ({ request }) => {
      const response = await request.get(`${API_BASE}/bitcoin/data`);

      expect(response.status()).toBe(200);

      const json = await response.json();

      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('error');
      expect(json).toHaveProperty('meta');

      expect(json.data).toMatchObject({
        asset: expect.any(String),
        price: expect.any(Number),
        currency: expect.any(String),
        fetchedAt: expect.any(String),
      });

      expect(Array.isArray(json.data.news)).toBe(true);

      expect(json.meta).toMatchObject({
        latencyMs: expect.any(Number),
      });
    });

    test('[1-2-API-003] Invalid asset returns error response @p0', async ({ request }) => {
      const response = await request.get(`${API_BASE}/invalidcoin12345/data`);

      expect(response.status()).toBe(400);

      const json = await response.json();

      expect(json.data).toBeNull();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe('INVALID_ASSET');
      expect(json.error.message).toBeDefined();
    });
  });

  test.describe('[P1] High Priority', () => {
    test('[1-2-API-004a] Stale data flag returned when providers down with cached data @p1', async ({ request }) => {
      const response = await request.get(`${API_BASE}/bitcoin/data`, {
        headers: {
          'X-Mock-Providers-Down': 'true',
        },
      });

      expect(response.status()).toBe(200);

      const json = await response.json();

      expect(json.data).toBeDefined();
      expect(json.data.isStale).toBe(true);
      expect(json.meta.staleWarning).toBe(true);
    });

    test('[1-2-API-004b] Returns 503 when providers down without cache @p1', async ({ request }) => {
      const response = await request.get(`${API_BASE}/bitcoin/data`, {
        headers: {
          'X-Mock-Providers-Down': 'true',
          'X-Mock-No-Cache': 'true',
        },
      });

      expect(response.status()).toBe(503);

      const json = await response.json();

      expect(json.data).toBeNull();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe('MARKET_DATA_UNAVAILABLE');
    });

    test('[1-2-API-005] Response time < 500ms (NFR-01) @p1', async ({ request }) => {
      const startTime = Date.now();

      const response = await request.get(`${API_BASE}/bitcoin/data`);

      const elapsed = Date.now() - startTime;

      expect(response.status()).toBe(200);
      expect(elapsed).toBeLessThan(500);

      const json = await response.json();
      expect(json.meta.latencyMs).toBeLessThan(500);
    });
  });

  test.describe('[P2] Medium Priority', () => {
    const SUPPORTED_ASSETS = ['bitcoin', 'ethereum', 'solana'];

    for (const asset of SUPPORTED_ASSETS) {
      test(`[1-2-API-006] ${asset} returns valid market data @p2`, async ({ request }) => {
        const response = await request.get(`${API_BASE}/${asset}/data`);

        expect(response.status()).toBe(200);

        const json = await response.json();

        expect(json.data.asset).toBe(asset);
        expect(json.data.price).toBeGreaterThan(0);
        expect(json.data.currency).toBe('usd');
      });
    }
  });

  test.describe('[P1] Error Scenarios', () => {
    test('[1-2-API-007] All providers down with no cache returns 503 @p1', async ({ request }) => {
      const response = await request.get(`${API_BASE}/bitcoin/data`, {
        headers: {
          'X-Mock-All-Down': 'true',
          'X-Mock-No-Cache': 'true',
        },
      });

      expect(response.status()).toBe(503);

      const json = await response.json();

      expect(json.data).toBeNull();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe('MARKET_DATA_UNAVAILABLE');
    });
  });

  test.describe('[P2] News Data', () => {
    test('[1-2-API-008] News items have required fields when present @p2', async ({ request }) => {
      const response = await request.get(`${API_BASE}/bitcoin/data`);

      expect(response.status()).toBe(200);

      const json = await response.json();

      expect(Array.isArray(json.data.news)).toBe(true);

      if (json.data.news.length > 0) {
        const firstNews = json.data.news[0];

        expect(firstNews).toHaveProperty('title');
        expect(firstNews).toHaveProperty('source');
        expect(firstNews).toHaveProperty('timestamp');

        expect(typeof firstNews.title).toBe('string');
        expect(typeof firstNews.source).toBe('string');
      }
    });

    test('[1-2-API-009] News array structure is valid @p2', async ({ request }) => {
      const response = await request.get(`${API_BASE}/bitcoin/data`);

      expect(response.status()).toBe(200);

      const json = await response.json();

      expect(Array.isArray(json.data.news)).toBe(true);

      for (const newsItem of json.data.news) {
        expect(newsItem).toHaveProperty('title');
        expect(typeof newsItem.title).toBe('string');
      }
    });
  });
});
