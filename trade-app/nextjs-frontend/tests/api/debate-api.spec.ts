import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

/**
 * Story 1-3: Debate Engine Core (LangGraph) - API Tests
 *
 * Mock Headers for Testing Failure Scenarios:
 * - X-Mock-Stale-Data: Simulates stale market data (>60s old)
 * - X-Mock-LLM-Failover: Simulates LLM provider failure
 *
 * @see trade-app/fastapi_backend/app/middleware/mock_middleware.py
 */
const API_BASE = '/api/debate';

test.describe('[1-3] Debate API Tests', () => {
  test.describe('[P0] Critical Path', () => {
    test('[1-3-API-001] POST /api/debate/start returns valid response @p0', async ({ request }) => {
      const asset = 'bitcoin';

      const response = await request.post(`${API_BASE}/start`, {
        data: { asset },
      });

      expect(response.status()).toBe(200);

      const json = await response.json();

      expect(json.data).toBeDefined();
      expect(json.data.debateId).toMatch(/^deb_[a-z0-9]+$/);
      expect(json.data.asset).toBe(asset);
      expect(json.data.status).toBe('completed');
      expect(Array.isArray(json.data.messages)).toBe(true);
      expect(json.data.messages.length).toBeGreaterThan(0);
      expect(json.error).toBeNull();
      expect(json.meta).toBeDefined();
    });

    test('[1-3-API-002] Debate response matches Standard Response Envelope @p0', async ({ request }) => {
      const response = await request.post(`${API_BASE}/start`, {
        data: { asset: 'ethereum' },
      });

      expect(response.status()).toBe(200);

      const json = await response.json();

      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('error');
      expect(json).toHaveProperty('meta');

      expect(json.data).toMatchObject({
        debateId: expect.any(String),
        asset: expect.any(String),
        status: expect.any(String),
        messages: expect.any(Array),
        currentTurn: expect.any(Number),
        maxTurns: expect.any(Number),
        createdAt: expect.any(String),
      });

      expect(json.data.debateId).toMatch(/^deb_/);
      expect(json.data.currentTurn).toBeGreaterThanOrEqual(0);
      expect(json.data.maxTurns).toBeGreaterThan(0);
    });

    test('[1-3-API-003] Debate messages have Bull and Bear roles @p0', async ({ request }) => {
      const response = await request.post(`${API_BASE}/start`, {
        data: { asset: 'solana' },
      });

      expect(response.status()).toBe(200);

      const json = await response.json();

      const roles = json.data.messages.map((m: { role: string }) => m.role);
      expect(roles).toContain('bull');
      expect(roles).toContain('bear');
    });
  });

  test.describe('[P0] Validation', () => {
    test('[1-3-API-004] Empty asset returns validation error @p0', async ({ request }) => {
      const response = await request.post(`${API_BASE}/start`, {
        data: { asset: '' },
      });

      expect(response.status()).toBe(422);

      const json = await response.json();

      expect(json.detail).toBeDefined();
    });

    test('[1-3-API-005] Asset too long returns validation error @p0', async ({ request }) => {
      const response = await request.post(`${API_BASE}/start`, {
        data: { asset: 'a'.repeat(21) },
      });

      expect(response.status()).toBe(422);
    });
  });

  test.describe('[P1] Error Scenarios', () => {
    test('[1-3-API-006] Stale market data returns 400 error @p1', async ({ request }) => {
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
      expect(json.detail.error.code).toBe('STALE_MARKET_DATA');
      expect(json.detail.error.message).toContain('stale');
    });

    test('[1-3-API-007] LLM provider failure returns 503 error @p1', async ({ request }) => {
      const response = await request.post(`${API_BASE}/start`, {
        data: { asset: 'bitcoin' },
        headers: {
          'X-Mock-LLM-Failover': 'true',
        },
      });

      expect(response.status()).toBe(503);

      const json = await response.json();

      expect(json.detail).toBeDefined();
      expect(json.detail.error).toBeDefined();
      expect(json.detail.error.code).toBe('LLM_PROVIDER_ERROR');
    });
  });

  test.describe('[P1] Response Quality', () => {
    test('[1-3-API-008] Debate completes within max turns @p1', async ({ request }) => {
      const response = await request.post(`${API_BASE}/start`, {
        data: { asset: 'bitcoin' },
      });

      expect(response.status()).toBe(200);

      const json = await response.json();

      expect(json.data.currentTurn).toBeLessThanOrEqual(json.data.maxTurns);
      expect(json.data.maxTurns).toBe(6);
    });

    test('[1-3-API-009] Messages contain non-empty content @p1', async ({ request }) => {
      const response = await request.post(`${API_BASE}/start`, {
        data: { asset: 'ethereum' },
      });

      expect(response.status()).toBe(200);

      const json = await response.json();

      for (const message of json.data.messages) {
        expect(message.content).toBeDefined();
        expect(typeof message.content).toBe('string');
        expect(message.content.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('[P2] Edge Cases', () => {
    const VALID_ASSETS = ['bitcoin', 'ethereum', 'solana', 'BTC', 'ETH'];

    for (const asset of VALID_ASSETS) {
      test(`[1-3-API-010] ${asset} starts debate successfully @p2`, async ({ request }) => {
        const response = await request.post(`${API_BASE}/start`, {
          data: { asset },
        });

        expect(response.status()).toBe(200);

        const json = await response.json();

        expect(json.data.asset).toBe(asset.toLowerCase());
      });
    }

    test('[1-3-API-011] Debate response latency is reasonable @p2', async ({ request }) => {
      const startTime = Date.now();

      const response = await request.post(`${API_BASE}/start`, {
        data: { asset: 'bitcoin' },
      });

      const elapsed = Date.now() - startTime;

      expect(response.status()).toBe(200);
      expect(elapsed).toBeLessThan(30000);
    });
  });

  test.describe('[P2] Forbidden Phrase Redaction', () => {
    test('[1-3-API-012] Responses do not contain forbidden phrases @p2', async ({ request }) => {
      const FORBIDDEN_PHRASES = [
        'guaranteed',
        'risk-free',
        'safe bet',
        'sure thing',
        '100%',
        'certainly will',
        'always goes',
      ];

      const response = await request.post(`${API_BASE}/start`, {
        data: { asset: 'bitcoin' },
      });

      expect(response.status()).toBe(200);

      const json = await response.json();

      const allContent = json.data.messages
        .map((m: { content: string }) => m.content)
        .join(' ')
        .toLowerCase();

      for (const phrase of FORBIDDEN_PHRASES) {
        expect(allContent).not.toContain(phrase.toLowerCase());
      }
    });
  });
});
