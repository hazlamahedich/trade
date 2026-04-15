import { getLandingPageData } from "@/features/landing/actions/landing-data-action";
import { createActiveDebateSummary, createRecentDebatePreview } from "../factories/landing-factory";

const mockDebate = createActiveDebateSummary({ id: "active1", status: "active" });
const mockRecent = [
  createRecentDebatePreview({ externalId: "r1" }),
  createRecentDebatePreview({ externalId: "r2" }),
];

function mockFetchSequence(responses: Array<{ ok: boolean; json?: unknown; status?: number; throwError?: boolean }>) {
  let i = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn(() => {
    const cfg = responses[i++];
    if (cfg === undefined) return Promise.reject(new Error("Unexpected fetch call"));
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

  it("logs error when active endpoint returns non-OK status", async () => {
    mockFetchSequence([
      { ok: false, status: 500, throwError: true },
      { ok: true, json: { data: [], error: null, meta: {} } },
    ]);

    const result = await getLandingPageData();
    expect(result.activeDebate).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[landing]"),
      expect.any(String),
    );
  });

  it("logs error when active response body is not valid JSON", async () => {
    mockFetchSequence([
      { ok: true } as { ok: boolean; throwError?: boolean; json?: unknown },
      { ok: true, json: { data: [], error: null, meta: {} } },
    ]);

    const result = await getLandingPageData();
    expect(result.activeDebate).toBeNull();
  });

  it("skips activeDebate when envelope data is null (not undefined)", async () => {
    mockFetchSequence([
      { ok: true, json: { data: null, error: null, meta: {} } },
      { ok: true, json: { data: [], error: null, meta: {} } },
    ]);

    const result = await getLandingPageData();
    expect(result.activeDebate).toBeNull();
    expect(result.recentDebates).toEqual([]);
  });

  it("returns recentDebates when active fetch succeeds but recent fetch fails", async () => {
    mockFetchSequence([
      { ok: true, json: { data: mockDebate, error: null, meta: {} } },
      { ok: false, throwError: true },
    ]);

    const result = await getLandingPageData();
    expect(result.activeDebate).toEqual(mockDebate);
    expect(result.recentDebates).toEqual([]);
  });

  it("handles sequential invocations correctly", async () => {
    mockFetchSequence([
      { ok: true, json: { data: mockDebate, error: null, meta: {} } },
      { ok: true, json: { data: mockRecent, error: null, meta: {} } },
    ]);

    const r1 = await getLandingPageData();
    expect(r1.activeDebate).toEqual(mockDebate);
    expect(r1.recentDebates).toEqual(mockRecent);
  });

  it("uses correct endpoint URLs", async () => {
    mockFetchSequence([
      { ok: true, json: { data: null, error: null, meta: {} } },
      { ok: true, json: { data: [], error: null, meta: {} } },
    ]);

    await getLandingPageData();

    const fetchCalls = (globalThis.fetch as jest.Mock).mock.calls;
    expect(fetchCalls[0][0]).toBe("http://localhost:8000/api/debate/active");
    expect(fetchCalls[1][0]).toBe("http://localhost:8000/api/debate/history?status=completed&size=3");
  });

  it("returns empty recentDebates when json.data is not an array", async () => {
    mockFetchSequence([
      { ok: true, json: { data: null, error: null, meta: {} } },
      { ok: true, json: { data: { not: "array" }, error: null, meta: {} } },
    ]);

    const result = await getLandingPageData();
    expect(result.recentDebates).toEqual([]);
  });
});
