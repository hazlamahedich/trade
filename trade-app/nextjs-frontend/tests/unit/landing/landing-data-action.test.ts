import { getLandingPageData } from "@/features/landing/actions/landing-data-action";
import { createActiveDebateSummary, createRecentDebatePreview } from "../factories/landing-factory";

const mockDebate = createActiveDebateSummary({ id: "active1", status: "active" });
const mockRecent = [
  createRecentDebatePreview({ externalId: "r1" }),
  createRecentDebatePreview({ externalId: "r2" }),
];

function mockFetchSequence(responses: Array<{ ok: boolean; json?: unknown; error?: boolean }>) {
  let i = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn(() => {
    const cfg = responses[i++];
    if (cfg === undefined) return Promise.reject(new Error("Unexpected fetch call"));
    if (cfg.error) return Promise.reject(new Error("Network error"));
    return Promise.resolve({
      ok: cfg.ok,
      json: () => Promise.resolve(cfg.json),
    } as unknown as Response);
  });
  return originalFetch;
}

describe("[4.4-UNIT-011] getLandingPageData server action", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("given successful responses from both endpoints, when getLandingPageData is called, then it returns active debate and recent debates", async () => {
    mockFetchSequence([
      { ok: true, json: { data: mockDebate, error: null, meta: {} } },
      { ok: true, json: { data: mockRecent, error: null, meta: {} } },
    ]);

    const result = await getLandingPageData();
    expect(result.activeDebate).toEqual(mockDebate);
    expect(result.recentDebates).toEqual(mockRecent);
  });

  it("given null data from active endpoint, when getLandingPageData is called, then it returns null activeDebate", async () => {
    mockFetchSequence([
      { ok: true, json: { data: null, error: null, meta: {} } },
      { ok: true, json: { data: [], error: null, meta: {} } },
    ]);

    const result = await getLandingPageData();
    expect(result.activeDebate).toBeNull();
    expect(result.recentDebates).toEqual([]);
  });

  it("given a network error on active endpoint, when getLandingPageData is called, then it gracefully returns null activeDebate", async () => {
    mockFetchSequence([
      { ok: false, error: true },
      { ok: true, json: { data: mockRecent, error: null, meta: {} } },
    ]);

    const result = await getLandingPageData();
    expect(result.activeDebate).toBeNull();
    expect(result.recentDebates).toEqual(mockRecent);
  });

  it("given an invalid envelope on active endpoint, when getLandingPageData is called, then it gracefully returns null activeDebate", async () => {
    mockFetchSequence([
      { ok: true, json: "not-an-object" },
      { ok: true, json: { data: [], error: null, meta: {} } },
    ]);

    const result = await getLandingPageData();
    expect(result.activeDebate).toBeNull();
  });

  it("given non-array data for recent debates, when getLandingPageData is called, then it returns empty recentDebates", async () => {
    mockFetchSequence([
      { ok: true, json: { data: null, error: null, meta: {} } },
      { ok: true, json: { data: "not-array", error: null, meta: {} } },
    ]);

    const result = await getLandingPageData();
    expect(result.recentDebates).toEqual([]);
  });

  it("given a network error on recent endpoint, when getLandingPageData is called, then it returns empty recentDebates with active debate intact", async () => {
    mockFetchSequence([
      { ok: true, json: { data: mockDebate, error: null, meta: {} } },
      { ok: false, error: true },
    ]);

    const result = await getLandingPageData();
    expect(result.activeDebate).toEqual(mockDebate);
    expect(result.recentDebates).toEqual([]);
  });

  it("given both endpoints fail, when getLandingPageData is called, then it returns empty defaults", async () => {
    mockFetchSequence([
      { ok: false, error: true },
      { ok: false, error: true },
    ]);

    const result = await getLandingPageData();
    expect(result).toEqual({ activeDebate: null, recentDebates: [] });
  });
});
