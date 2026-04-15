import { getLandingPageData } from "@/features/landing/actions/landing-data-action";
import { createActiveDebateSummary, createRecentDebatePreview } from "../factories/landing-factory";

const mockDebate = createActiveDebateSummary({ id: "active1", status: "active" });
const mockRecent = [
  createRecentDebatePreview({ externalId: "r1" }),
  createRecentDebatePreview({ externalId: "r2" }),
];

function mockFetchResponse(cfg: { ok: boolean; json?: unknown; status?: number; throwError?: boolean }) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn(() => {
    if (cfg.throwError) return Promise.reject(new Error("Network error"));
    return Promise.resolve({
      ok: cfg.ok,
      status: cfg.status ?? (cfg.ok ? 200 : 500),
      json: () => {
        if (cfg.json !== undefined) return Promise.resolve(cfg.json);
        return Promise.reject(new Error("Invalid JSON"));
      },
    } as unknown as Response);
  });
  return originalFetch;
}

describe("[4.4-UNIT-011-EDGE] getLandingPageData edge cases", () => {
  let originalFetch: typeof globalThis.fetch;
  let consoleErrorSpy: jest.SpyInstance;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalEnv = process.env.API_BASE_URL;
    process.env.API_BASE_URL = "http://localhost:8000";
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.API_BASE_URL = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  it("given a 500 from landing endpoint, when getLandingPageData is called, then it logs an error", async () => {
    mockFetchResponse({ ok: false, status: 500, throwError: true });

    const result = await getLandingPageData();
    expect(result).toEqual({ activeDebate: null, recentDebates: [] });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[landing]"),
      expect.any(String),
    );
  });

  it("given a response with invalid JSON body, when getLandingPageData is called, then it logs an error and returns defaults", async () => {
    mockFetchResponse({ ok: true } as { ok: boolean; throwError?: boolean; json?: unknown });

    const result = await getLandingPageData();
    expect(result).toEqual({ activeDebate: null, recentDebates: [] });
  });

  it("given envelope with null data, when getLandingPageData is called, then it returns defaults", async () => {
    mockFetchResponse({
      ok: true,
      json: { data: null, error: null, meta: {} },
    });

    const result = await getLandingPageData();
    expect(result).toEqual({ activeDebate: null, recentDebates: [] });
  });

  it("given successful response, when getLandingPageData is called, then it returns both fields", async () => {
    mockFetchResponse({
      ok: true,
      json: {
        data: { activeDebate: mockDebate, recentDebates: mockRecent },
        error: null,
        meta: {},
      },
    });

    const result = await getLandingPageData();
    expect(result.activeDebate).toEqual(mockDebate);
    expect(result.recentDebates).toEqual(mockRecent);
  });

  it("given API_BASE_URL is set, when getLandingPageData is called, then it fetches from /api/landing", async () => {
    mockFetchResponse({
      ok: true,
      json: {
        data: { activeDebate: null, recentDebates: [] },
        error: null,
        meta: {},
      },
    });

    await getLandingPageData();

    const fetchCalls = (globalThis.fetch as jest.Mock).mock.calls;
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0][0]).toBe("http://localhost:8000/api/landing");
  });

  it("given non-array recentDebates, when getLandingPageData is called, then it returns empty recentDebates", async () => {
    mockFetchResponse({
      ok: true,
      json: {
        data: { activeDebate: null, recentDebates: { not: "array" } },
        error: null,
        meta: {},
      },
    });

    const result = await getLandingPageData();
    expect(result.recentDebates).toEqual([]);
  });
});
