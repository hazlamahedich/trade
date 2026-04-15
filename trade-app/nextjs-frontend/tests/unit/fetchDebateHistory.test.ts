import { fetchDebateHistory, extractVotes } from "@/features/debate/api/debate-history";
import { getApiBaseUrl } from "@/lib/api/config";

const originalEnv = process.env;

describe("getApiBaseUrl", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("[P0] returns the API_BASE_URL when set", () => {
    process.env.API_BASE_URL = "http://localhost:8000";
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("[P0] throws when API_BASE_URL is not set", () => {
    delete process.env.API_BASE_URL;
    expect(() => getApiBaseUrl()).toThrow("API_BASE_URL env var is not set");
  });
});

describe("fetchDebateHistory", () => {
  const mockResponse = {
    data: [
      {
        externalId: "test-1",
        asset: "btc",
        status: "completed",
        guardianVerdict: null,
        guardianInterruptsCount: 0,
        totalVotes: 100,
        voteBreakdown: { bull: 60, bear: 40 },
        winner: "bull",
        createdAt: "2026-04-14T00:00:00Z",
        completedAt: "2026-04-14T01:00:00Z",
      },
    ],
    error: null,
    meta: { page: 1, size: 20, total: 1, pages: 1 },
  };

  beforeEach(() => {
    process.env.API_BASE_URL = "http://localhost:8000";
    jest.restoreAllMocks();
  });

  it("[P0] constructs URL with required params", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await fetchDebateHistory({ page: 2, size: 10 });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("page=2");
    expect(calledUrl).toContain("size=10");
  });

  it("[P0] includes optional asset param when provided", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await fetchDebateHistory({ page: 1, size: 20, asset: "btc" });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("asset=btc");
  });

  it("[P0] includes optional outcome param when provided", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await fetchDebateHistory({ page: 1, size: 20, outcome: "bull" });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("outcome=bull");
  });

  it("[P1] does not include optional params when not provided", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await fetchDebateHistory({ page: 1, size: 20 });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("asset=");
    expect(calledUrl).not.toContain("outcome=");
  });

  it("[P0] throws on HTTP error with status code", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { message: "Internal error" } }),
    });

    await expect(
      fetchDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow("HTTP 500: Internal error");
  });

  it("[P0] throws on HTTP error without error body detail", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });

    await expect(
      fetchDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow("HTTP 503");
  });

  it("[P1] handles JSON parse failure in error body gracefully", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("invalid json")),
    });

    await expect(
      fetchDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow("HTTP 500");
  });

  it("[P0] throws on Zod validation failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ invalid: "shape" }),
    });

    await expect(
      fetchDebateHistory({ page: 1, size: 20 }),
    ).rejects.toThrow();
  });

  it("[P0] returns parsed response on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchDebateHistory({ page: 1, size: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.page).toBe(1);
  });
});

describe("extractVotes console.warn branch", () => {
  it("[P1] warns when keys exist but all three standard keys are zero", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    extractVotes({ unknown: 10, other: 20 });
    expect(warnSpy).toHaveBeenCalledWith(
      "voteBreakdown has unexpected keys:",
      { unknown: 10, other: 20 },
    );
    warnSpy.mockRestore();
  });

  it("[P1] does not warn when standard keys have values", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    extractVotes({ bull: 5, bear: 3 });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("[P1] does not warn on empty object", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    extractVotes({});
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
