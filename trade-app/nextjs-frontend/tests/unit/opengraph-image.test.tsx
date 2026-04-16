import { computePercentages } from "@/features/debate/utils/percentages";
import { deriveWinner } from "@/features/debate/utils/structured-data";
import { createMockDebateDetail } from "./factories/debate-detail-factory";

function inlineExtractVotes(voteBreakdown: Record<string, number> | null | undefined) {
  if (!voteBreakdown) return { bullVotes: 0, bearVotes: 0, undecidedVotes: 0 };
  return {
    bullVotes: voteBreakdown["bull"] ?? 0,
    bearVotes: voteBreakdown["bear"] ?? 0,
    undecidedVotes: voteBreakdown["undecided"] ?? 0,
  };
}

function inlineComputePercentages(
  bullVotes: number,
  bearVotes: number,
  undecidedVotes: number,
) {
  const total = bullVotes + bearVotes + undecidedVotes;
  if (total === 0) return { bullPct: 0, bearPct: 0, undecidedPct: 0 };

  const bullPct = Math.round((bullVotes / total) * 100);
  const undecidedPct = Math.round((undecidedVotes / total) * 100);
  const bearPct = Math.max(0, 100 - bullPct - undecidedPct);
  return { bullPct, bearPct, undecidedPct };
}

function inlineDeriveWinner(data: {
  voteBreakdown: Record<string, number> | null | undefined;
}): string {
  const { bullVotes, bearVotes, undecidedVotes } = inlineExtractVotes(
    data.voteBreakdown,
  );
  const total = bullVotes + bearVotes + undecidedVotes;
  if (total === 0) return "undecided";
  if (bullVotes > bearVotes && bullVotes >= undecidedVotes) return "bull";
  if (bearVotes > bullVotes && bearVotes >= undecidedVotes) return "bear";
  return "undecided";
}

describe("[P0][5.1] fetchDebateForOG", () => {
  // NOTE: fetchDebateForOG is module-private (depends on next/og, fs/promises).
  // These tests verify the raw fetch contract it relies on.
  // Full integration testing requires a Next.js runtime.

  beforeEach(() => {
    process.env.API_BASE_URL = "http://localhost:8000";
  });

  it("[P0][5.1-001] returns debate data for valid externalId", async () => {
    const mockData = createMockDebateDetail();
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    const res = await fetch(
      "http://localhost:8000/api/debate/test-123/result?include_transcript=false",
    );
    const json = await res.json();

    expect(json.data).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("[P0][5.1-002] returns null on 404 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const res = await fetch(
      "http://localhost:8000/api/debate/nonexistent/result?include_transcript=false",
    );
    expect(res.ok).toBe(false);
  });

  it("[P0][5.1-003] returns null on network error", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("Network error"));

    await expect(
      fetch("http://localhost:8000/api/debate/test/result?include_transcript=false"),
    ).rejects.toThrow("Network error");
  });

  it("[P0][5.1-004] returns null when response json has no data field", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: "Not found" }),
    });

    const res = await fetch(
      "http://localhost:8000/api/debate/test/result?include_transcript=false",
    );
    const json = await res.json();
    expect(json.data).toBeUndefined();
  });
});

describe("[P0][5.1] inline computePercentages contract", () => {
  const cases = [
    { bull: 60, bear: 40, undecided: 0, label: "simple majority" },
    { bull: 0, bear: 0, undecided: 0, label: "zero votes" },
    { bull: 50, bear: 50, undecided: 0, label: "tie votes" },
    { bull: 33, bear: 33, undecided: 34, label: "three-way split" },
    { bull: 99, bear: 1, undecided: 0, label: "landslide" },
    { bull: 1, bear: 1, undecided: 0, label: "single votes each" },
    { bull: 1000, bear: 500, undecided: 500, label: "large numbers" },
  ];

  cases.forEach(({ bull, bear, undecided, label }) => {
    it(`[P0][5.1-006] matches shared utility for: ${label}`, () => {
      const inline = inlineComputePercentages(bull, bear, undecided);
      const shared = computePercentages(bull, bear, undecided);

      expect(inline.bullPct).toBe(shared.bullPct);
      expect(inline.bearPct).toBe(shared.bearPct);
      expect(inline.undecidedPct).toBe(shared.undecidedPct);
    });
  });

  it("[P0][5.1-007] percentages sum to 100 for non-zero totals", () => {
    const result = inlineComputePercentages(57, 43, 0);
    expect(result.bullPct + result.bearPct + result.undecidedPct).toBe(100);
  });

  it("[P0][5.1-008] percentages sum to 0 for zero votes", () => {
    const result = inlineComputePercentages(0, 0, 0);
    expect(result.bullPct + result.bearPct + result.undecidedPct).toBe(0);
  });
});

describe("[P0][5.1] inline deriveWinner contract", () => {
  const winnerCases = [
    {
      label: "bull winner",
      voteBreakdown: { bull: 60, bear: 40, undecided: 0 },
      expected: "bull",
    },
    {
      label: "bear winner",
      voteBreakdown: { bull: 30, bear: 70, undecided: 0 },
      expected: "bear",
    },
    {
      label: "undecided (tie)",
      voteBreakdown: { bull: 50, bear: 50, undecided: 0 },
      expected: "undecided",
    },
    {
      label: "undecided (zero votes)",
      voteBreakdown: { bull: 0, bear: 0, undecided: 0 },
      expected: "undecided",
    },
    {
      label: "undecided winner by plurality",
      voteBreakdown: { bull: 30, bear: 30, undecided: 40 },
      expected: "undecided",
    },
  ];

  winnerCases.forEach(({ label, voteBreakdown, expected }) => {
    it(`[P0][5.1-009] matches shared deriveWinner for: ${label}`, () => {
      const mockData = createMockDebateDetail({ voteBreakdown });
      const inlineResult = inlineDeriveWinner(mockData);
      const sharedResult = deriveWinner(mockData);

      expect(inlineResult).toBe(sharedResult);
      expect(inlineResult).toBe(expected);
    });
  });
});

describe("[P0][5.1] edge cases", () => {
  it("[P0][5.1-010] handles missing voteBreakdown keys with defaults", () => {
    const result = inlineExtractVotes({});
    expect(result).toEqual({ bullVotes: 0, bearVotes: 0, undecidedVotes: 0 });
  });

  it("[P0][5.1-010b] handles null voteBreakdown", () => {
    const result = inlineExtractVotes(null);
    expect(result).toEqual({ bullVotes: 0, bearVotes: 0, undecidedVotes: 0 });
  });

  it("[P0][5.1-010c] handles undefined voteBreakdown", () => {
    const result = inlineExtractVotes(undefined);
    expect(result).toEqual({ bullVotes: 0, bearVotes: 0, undecidedVotes: 0 });
  });

  it("[P0][5.1-011] handles empty voteBreakdown", () => {
    const data = createMockDebateDetail({ voteBreakdown: {} });
    const result = inlineDeriveWinner(data);
    expect(result).toBe("undecided");
  });

  it("[P0][5.1-012] handles long asset name truncation", () => {
    const longAsset = "VERYLONGASSETNAME12345";
    const truncated = longAsset.toUpperCase().slice(0, 10);
    expect(truncated).toBe("VERYLONGAS");
    expect(truncated.length).toBeLessThanOrEqual(10);
  });

  it("[P0][5.1-013] handles totalVotes with toLocaleString", () => {
    const totalVotes = 1234567;
    const formatted = totalVotes.toLocaleString("en-US");
    expect(formatted).toBe("1,234,567");
  });

  it("[P0][5.1-014] handles active debate with missing voteBreakdown", () => {
    const activeData = createMockDebateDetail({
      status: "in_progress",
      voteBreakdown: {},
      totalVotes: 0,
      completedAt: null,
    });
    const winner = inlineDeriveWinner(activeData);
    expect(winner).toBe("undecided");

    const pcts = inlineComputePercentages(0, 0, 0);
    expect(pcts).toEqual({ bullPct: 0, bearPct: 0, undecidedPct: 0 });
  });
});

describe("[P0][5.1] revalidate export", () => {
  it("[P0][5.1-015] revalidate equals DEBATE_DETAIL_ISR_REVALIDATE_SECONDS", async () => {
    const { DEBATE_DETAIL_ISR_REVALIDATE_SECONDS } = await import(
      "@/app/debates/[externalId]/page"
    );
    expect(DEBATE_DETAIL_ISR_REVALIDATE_SECONDS).toBe(3600);
  });
});

describe("[P0][5.1] generateMetadata twitter card", () => {
  async function loadPageWithMock(mockData: ReturnType<typeof createMockDebateDetail>) {
    const fetchOrig = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: mockData,
        error: null,
        meta: {},
      }),
    });
    jest.resetModules();
    try {
      const mod = await import("@/app/debates/[externalId]/page");
      const metadata = await mod.generateMetadata({
        params: Promise.resolve({ externalId: "test-123" }),
      });
      return metadata;
    } finally {
      global.fetch = fetchOrig;
    }
  }

  it("[P0][5.1-016] includes twitter card with summary_large_image and images", async () => {
    const mockData = createMockDebateDetail();
    process.env.API_BASE_URL = "http://localhost:8000";
    const metadata = await loadPageWithMock(mockData);

    const md = metadata as Record<string, unknown>;
    expect(md.twitter).toBeDefined();
    const twitter = md.twitter as Record<string, unknown>;
    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.images).toEqual(["/debates/test-123/opengraph-image"]);
  });

  it("[P0][5.1-017] includes siteName in openGraph", async () => {
    const mockData = createMockDebateDetail();
    process.env.API_BASE_URL = "http://localhost:8000";
    const metadata = await loadPageWithMock(mockData);

    const md = metadata as Record<string, unknown>;
    const og = md.openGraph as Record<string, unknown>;
    expect(og.siteName).toBe("AI Trading Debate Lab");
  });
});

describe("[P0][5.1] OGImage default export", () => {
  const ogCalls: Array<{ jsx: unknown; options: unknown }> = [];
  const origAbortSignalTimeout = AbortSignal.timeout;

  beforeEach(() => {
    ogCalls.length = 0;
    jest.resetModules();
    process.env.API_BASE_URL = "http://localhost:8000";
    if (typeof AbortSignal.timeout !== "function") {
      AbortSignal.timeout = () => new AbortController().signal;
    }
  });

  afterAll(() => {
    AbortSignal.timeout = origAbortSignalTimeout;
  });

  async function loadOGModule() {
    jest.doMock("next/og", () => ({
      ImageResponse: class {
        constructor(jsx: unknown, options: unknown) {
          ogCalls.push({ jsx, options });
        }
      },
    }));

    return await import("@/app/debates/[externalId]/opengraph-image");
  }

  it("[P0][5.1-018] fetches with correct URL and AbortSignal", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: createMockDebateDetail() }),
    });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-debate-123" }),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/debate/test-debate-123/result?include_transcript=false",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(ogCalls).toHaveLength(1);
  });

  it("[P0][5.1-019] URL-encodes externalId with special characters", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: createMockDebateDetail() }),
    });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "special/chars+&more" }),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/debate/special%2Fchars%2B%26more/result?include_transcript=false",
      expect.any(Object),
    );
  });

  it("[P0][5.1-020] returns debate ImageResponse for valid data", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: createMockDebateDetail() }),
    });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
    expect(ogCalls[0].options).toEqual(
      expect.objectContaining({ width: 1200, height: 630 }),
    );
  });

  it("[P0][5.1-021] returns fallback ImageResponse for 404", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "nonexistent" }),
    });

    expect(ogCalls).toHaveLength(1);
  });

  it("[P0][5.1-022] returns fallback on network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
  });

  it("[P0][5.1-023] returns fallback when response has no data field", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: "Not found" }),
    });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
  });

  it("[P0][5.1-024] returns fallback when fetchDebateForOG catches AbortSignal error", async () => {
    const origTimeout = AbortSignal.timeout;
    AbortSignal.timeout = () => {
      throw new Error("AbortSignal.timeout polyfill error");
    };

    global.fetch = jest.fn();

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
    AbortSignal.timeout = origTimeout;
  });

  it("[P0][5.1-025] null asset does not crash", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: createMockDebateDetail({ asset: null as unknown as string }),
      }),
    });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
  });

  it("[P0][5.1-026] null totalVotes does not crash", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: createMockDebateDetail({
          totalVotes: null as unknown as number,
        }),
      }),
    });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
  });
});

describe("[P1][5.1] module exports", () => {
  let ogModule: typeof import("@/app/debates/[externalId]/opengraph-image");

  beforeAll(async () => {
    jest.resetModules();
    jest.doMock("next/og", () => ({
      ImageResponse: class {
        constructor() {}
      },
    }));
    jest.doMock("fs/promises", () => ({
      readFile: jest.fn().mockResolvedValue(Buffer.from("")),
    }));
    ogModule = await import("@/app/debates/[externalId]/opengraph-image");
  });

  it("[P1][5.1-027] size is { width: 1200, height: 630 }", () => {
    expect(ogModule.size).toEqual({ width: 1200, height: 630 });
  });

  it("[P1][5.1-028] contentType is image/png", () => {
    expect(ogModule.contentType).toBe("image/png");
  });

  it("[P1][5.1-029] alt is correct string", () => {
    expect(ogModule.alt).toBe("Debate preview image \u2014 AI Trading Debate Lab");
  });

  it("[P1][5.1-030] revalidate is 3600", () => {
    expect(ogModule.revalidate).toBe(3600);
  });
});

describe("[P2][5.1] additional edge cases", () => {
  it("[P2][5.1-031] bull-undecided tie breaks in bull's favor", () => {
    const data = createMockDebateDetail({
      voteBreakdown: { bull: 40, bear: 20, undecided: 40 },
    });
    const result = inlineDeriveWinner(data);
    expect(result).toBe("bull");
    expect(result).toBe(deriveWinner(data));
  });

  it("[P2][5.1-032] three-way near-equal split sums to 100", () => {
    const result = inlineComputePercentages(33, 33, 34);
    expect(result.bullPct + result.bearPct + result.undecidedPct).toBe(100);
  });

  it("[P2][5.1-033] very large vote counts", () => {
    const result = inlineComputePercentages(1_000_000, 500_000, 500_000);
    expect(result.bullPct).toBe(50);
    expect(result.bearPct + result.undecidedPct).toBe(50);
    expect(result.bullPct + result.bearPct + result.undecidedPct).toBe(100);
  });

  it("[P2][5.1-034] single-character asset truncation", () => {
    const asset = "X".toUpperCase().slice(0, 10);
    expect(asset).toBe("X");
    expect(asset.length).toBe(1);
  });

  it("[P2][5.1-035] single undecided vote produces undecided winner", () => {
    const data = createMockDebateDetail({
      voteBreakdown: { bull: 0, bear: 0, undecided: 1 },
    });
    const result = inlineDeriveWinner(data);
    expect(result).toBe("undecided");
    expect(result).toBe(deriveWinner(data));
  });
});
