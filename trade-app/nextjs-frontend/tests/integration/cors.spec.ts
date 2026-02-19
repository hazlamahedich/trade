import { test, expect } from '../support/fixtures';

test.describe('CORS Configuration @integration @p0', () => {
  test('[1-1-INT-001] should allow frontend origin to call /api/health', async ({ request }) => {
    const response = await request.get('/api/health', {
      headers: {
        Origin: 'http://localhost:3000',
      },
    });

    expect(response.status()).toBe(200);

    const corsHeaders = response.headers();
    expect(corsHeaders['access-control-allow-origin']).toBeTruthy();

    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe('healthy');
    expect(body.error).toBeNull();
    expect(body.meta).toBeDefined();
  });

  test('[1-1-INT-001b] should include CORS headers for preflight requests', async ({ request }) => {
    const response = await request.fetch('/api/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });

    expect(response.status()).toBe(200);

    const corsHeaders = response.headers();
    expect(corsHeaders['access-control-allow-origin']).toBeTruthy();
    expect(corsHeaders['access-control-allow-methods']).toBeTruthy();
    expect(corsHeaders['access-control-allow-headers']).toBeTruthy();
  });

  test('[1-1-INT-002] should return connected status for all services', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.data.status).toBe('healthy');
    expect(body.data.database).toBe('connected');
    expect(body.data.redis).toBe('connected');
    expect(body.error).toBeNull();
    expect(body.meta.version).toBe('1.0.0');
  });

  test('[1-1-INT-003] should reject requests from unauthorized origins', async ({ request }) => {
    const response = await request.get('/api/health', {
      headers: {
        Origin: 'https://malicious-site.com',
      },
    });

    const corsHeaders = response.headers();
    const allowOrigin = corsHeaders['access-control-allow-origin'];

    expect(
      allowOrigin === undefined || allowOrigin !== 'https://malicious-site.com'
    ).toBe(true);
  });
});
