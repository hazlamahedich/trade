import { getLandingPageData } from "@/features/landing/actions/landing-data-action";
import { createActiveDebateSummary, createRecentDebatePreview } from "../factories/landing-factory";

const mockDebate = createActiveDebateSummary({ id: "active1", status: "active" });
const mockRecent = [
  createRecentDebatePreview({ externalId: "r1" }),
  createRecentDebatePreview({ externalId: "r2" }),
];

function mockFetchResponse(response: { ok: boolean; json?: unknown; error?: boolean }) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn(() => {
    if (response.error) return Promise.reject(new Error("Network error"));
    return Promise.resolve({
      ok: response.ok,
      json: () => Promise.resolve(response.json),
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

  it("given successful response, when getLandingPageData is called, then it returns active debate and recent debates", async () => {
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

  it("given null activeDebate in response, when getLandingPageData is called, then it returns null activeDebate", async () => {
    mockFetchResponse({
      ok: true,
      json: {
        data: { activeDebate: null, recentDebates: [] },
        error: null,
        meta: {},
      },
    });

    const result = await getLandingPageData();
    expect(result.activeDebate).toBeNull();
    expect(result.recentDebates).toEqual([]);
  });

  it("given a network error, when getLandingPageData is called, then it gracefully returns defaults", async () => {
    mockFetchResponse({ ok: false, error: true });

    const result = await getLandingPageData();
    expect(result).toEqual({ activeDebate: null, recentDebates: [] });
  });

  it("given an invalid envelope, when getLandingPageData is called, then it gracefully returns defaults", async () => {
    mockFetchResponse({ ok: true, json: "not-an-object" });

    const result = await getLandingPageData();
    expect(result).toEqual({ activeDebate: null, recentDebates: [] });
  });

  it("given non-array recentDebates in response, when getLandingPageData is called, then it returns empty recentDebates", async () => {
    mockFetchResponse({
      ok: true,
      json: {
        data: { activeDebate: null, recentDebates: "not-array" },
        error: null,
        meta: {},
      },
    });

    const result = await getLandingPageData();
    expect(result.activeDebate).toBeNull();
    expect(result.recentDebates).toEqual([]);
  });

  it("given null data in envelope, when getLandingPageData is called, then it returns defaults", async () => {
    mockFetchResponse({
      ok: true,
      json: { data: null, error: null, meta: {} },
    });

    const result = await getLandingPageData();
    expect(result).toEqual({ activeDebate: null, recentDebates: [] });
  });

  it("given undefined activeDebate in response, when getLandingPageData is called, then it defaults to null", async () => {
    mockFetchResponse({
      ok: true,
      json: {
        data: { recentDebates: mockRecent },
        error: null,
        meta: {},
      },
    });

    const result = await getLandingPageData();
    expect(result.activeDebate).toBeNull();
    expect(result.recentDebates).toEqual(mockRecent);
  });
});
