import { test, expect } from '@playwright/test';

/**
 * Story 1-6: Stale Data Guard - API Tests
 *
 * Validates that the stale data guard prevents debates from starting with
 * outdated market data and exposes freshness status for consumers.
 *
 * Mock Headers for Testing Stale Scenarios:
 * - X-Mock-Stale-Data: Simulates stale market data (>60s old)
 * - X-Mock-Providers-Down: Simulates all external providers being unavailable
 *
 * @see trade-app/fastapi_backend/app/middleware/mock_middleware.py
 */
const API_BASE = '/api/debate';

const VALID_ASSETS = ['bitcoin', 'ethereum', 'solana'];

/** Stale threshold in seconds, matching backend config */
const STALE_THRESHOLD = 60;

test.describe('[1-6] Stale Data Guard API Tests', () => {
  test.describe('[P0] Critical Path', () => {
    test('[1-6-API-001] POST /api/debate/start returns 400 when market data is stale @p0', async ({ request }) => {
      const response = await request.post(`${API_BASE}/start`, {
        data: { asset: 'bitcoin' },
        headers: {
          'X-Mock-Stale-Data': 'true',
        },
      });

      expect(response.status()).toBe(400);

      const json = await response.json();

      expect(json.detail).toBeDefined();
      expect(json.detail.error).toBeDefined();
      expect(json.detail.error.code).toBe('STALE_DATA');
      expect(json.detail.error.message).toContain('stale');
    });

    for (const asset of VALID_ASSETS) {
      test(`[1-6-API-002] POST /api/debate/start returns 400 for ${asset} when data is stale @p0`, async ({ request }) => {
        const response = await request.post(`${API_BASE}/start`, {
          data: { asset },
          headers: {
            'X-Mock-Stale-Data': 'true',
          },
        });

        expect(response.status()).toBe(400);

        const json = await response.json();

        expect(json.detail).toBeDefined();
        expect(json.detail.error).toBeDefined();
        expect(json.detail.error.code).toBe('STALE_DATA');
      });
    }

    test('[1-6-API-003] GET /api/debate/{asset}/freshness returns freshness status when data is fresh @p0', async ({ request }) => {
      const response = await request.get(`${API_BASE}/bitcoin/freshness`);

      expect(response.status()).toBe(200);

      const json = await response.json();

      expect(json.data).toBeDefined();
      expect(json.data).toMatchObject({
        asset: expect.any(String),
        isStale: expect.any(Boolean),
        fetchedAt: expect.any(String),
        staleThresholdSeconds: expect.any(Number),
      });
      expect(json.error).toBeNull();
      expect(json.meta).toBeDefined();
    });
  });

  test.describe('[P0] Validation', () => {
    test('[1-6-API-004] POST /api/debate/start with invalid asset returns 422 matching validation pattern @p0', async ({ request }) => {
      const response = await request.post(`${API_BASE}/start`, {
        data: { asset: 'invalidcoin' },
      });

      expect(response.status()).toBe(422);

      const json = await response.json();

      expect(json.detail).toBeDefined();
    });
  });

  test.describe('[P1] Stale Data Scenarios', () => {
    test('[1-6-API-005] GET /api/debate/{asset}/freshness returns stale status when data is >60s old @p1', async ({ request }) => {
      const response = await request.get(`${API_BASE}/bitcoin/freshness`, {
        headers: {
          'X-Mock-Stale-Data': 'true',
        },
      });

      expect(response.status()).toBe(200);

      const json = await response.json();

      expect(json.data).toBeDefined();
      expect(json.data.isStale).toBe(true);
      expect(json.data.staleThresholdSeconds).toBe(STALE_THRESHOLD);
    });

    test('[1-6-API-006] GET /api/debate/{asset}/freshness returns fresh status when data is <60s threshold @p1', async ({ request }) => {
      const response = await request.get(`${API_BASE}/bitcoin/freshness`);

      expect(response.status()).toBe(200);

      const json = await response.json();

      expect(json.data).toBeDefined();
      expect(json.data.isStale).toBe(false);
      expect(json.data.staleThresholdSeconds).toBe(STALE_THRESHOLD);

      // Verify fetchedAt is within the freshness window
      const fetchedAt = new Date(json.data.fetchedAt).getTime();
      const now = Date.now();
      const ageSeconds = (now - fetchedAt) / 1000;
      expect(ageSeconds).toBeLessThan(STALE_THRESHOLD);
    });
  });

  test.describe('[P1] Error Format Consistency', () => {
    test('[1-6-API-007] Stale error response format matches debate-api error pattern @p1', async ({ request }) => {
      const response = await request.post(`${API_BASE}/start`, {
        data: { asset: 'bitcoin' },
        headers: {
          'X-Mock-Stale-Data': 'true',
        },
      });

      expect(response.status()).toBe(400);

      const json = await response.json();

      // Error envelope must match the existing pattern from debate-api.spec.ts (1-3-API-006)
      expect(json.detail).toBeDefined();
      expect(json.detail.error).toBeDefined();
      expect(json.detail.error).toMatchObject({
        code: expect.any(String),
        message: expect.any(String),
      });
      expect(json.detail.error.code).toBe('STALE_DATA');
      expect(typeof json.detail.error.message).toBe('string');
      expect(json.detail.error.message.length).toBeGreaterThan(0);
    });

    test('[1-6-API-008] Freshness response for invalid asset returns 400 @p1', async ({ request }) => {
      const response = await request.get(`${API_BASE}/invalidcoin12345/freshness`);

      expect(response.status()).toBe(400);

      const json = await response.json();

      expect(json.data).toBeNull();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe('INVALID_ASSET');
    });
  });

  test.describe('[P2] Edge Cases', () => {
    for (const asset of VALID_ASSETS) {
      test(`[1-6-API-009] Freshness endpoint returns valid response for ${asset} @p2`, async ({ request }) => {
        const response = await request.get(`${API_BASE}/${asset}/freshness`);

        expect(response.status()).toBe(200);

        const json = await response.json();

        expect(json.data.asset).toBe(asset);
        expect(json.data.isStale).toBe(false);
      });
    }

    test('[1-6-API-010] Freshness response latency is reasonable @p2', async ({ request }) => {
      const startTime = Date.now();

      const response = await request.get(`${API_BASE}/bitcoin/freshness`);

      const elapsed = Date.now() - startTime;

      expect(response.status()).toBe(200);
      expect(elapsed).toBeLessThan(2000);

      const json = await response.json();
      expect(json.meta).toBeDefined();
      expect(json.meta.latencyMs).toBeLessThan(2000);
    });
  });
});
