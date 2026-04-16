import { createMockDebateDetail } from "./factories/debate-detail-factory";

describe("[P0][5.1] revalidate export", () => {
  it("[P0][5.1-015] revalidate equals DEBATE_DETAIL_ISR_REVALIDATE_SECONDS", async () => {
    const { DEBATE_DETAIL_ISR_REVALIDATE_SECONDS } = await import(
      "@/lib/config/isr"
    );
    expect(DEBATE_DETAIL_ISR_REVALIDATE_SECONDS).toBe(3600);
  });
});

describe("[P0][5.1] generateMetadata twitter card", () => {
  async function loadPageWithMock(
    mockData: ReturnType<typeof createMockDebateDetail>,
  ) {
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

  afterEach(() => {
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

  function isFallbackImage(jsx: unknown): boolean {
    const serialized = JSON.stringify(jsx);
    return serialized.includes("Watch Bulls");
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
    expect(isFallbackImage(ogCalls[0].jsx)).toBe(false);
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
    expect(isFallbackImage(ogCalls[0].jsx)).toBe(false);
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
    expect(isFallbackImage(ogCalls[0].jsx)).toBe(false);
  });

  it("[P0][5.1-021] returns fallback ImageResponse for 404", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "nonexistent" }),
    });

    expect(ogCalls).toHaveLength(1);
    expect(isFallbackImage(ogCalls[0].jsx)).toBe(true);
  });

  it("[P0][5.1-022] returns fallback on network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
    expect(isFallbackImage(ogCalls[0].jsx)).toBe(true);
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
    expect(isFallbackImage(ogCalls[0].jsx)).toBe(true);
  });

  it("[P0][5.1-024] returns fallback when AbortSignal.timeout throws", async () => {
    AbortSignal.timeout = () => {
      throw new Error("AbortSignal.timeout polyfill error");
    };

    global.fetch = jest.fn();

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
    expect(isFallbackImage(ogCalls[0].jsx)).toBe(true);
  });

  it("[P0][5.1-025] null asset does not crash and returns debate image", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: createMockDebateDetail({
          asset: null as unknown as string,
        }),
      }),
    });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
    expect(isFallbackImage(ogCalls[0].jsx)).toBe(false);
  });

  it("[P0][5.1-026] null totalVotes does not crash and returns debate image", async () => {
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
    expect(isFallbackImage(ogCalls[0].jsx)).toBe(false);
  });

  it("[P0][5.1-036] zero votes shows placeholder bar with 'No votes yet'", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: createMockDebateDetail({
          totalVotes: 0,
          voteBreakdown: { bull: 0, bear: 0, undecided: 0 },
        }),
      }),
    });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
    expect(isFallbackImage(ogCalls[0].jsx)).toBe(false);
    const serialized = JSON.stringify(ogCalls[0].jsx);
    expect(serialized).toContain("No votes yet");
  });

  it("[P0][5.1-037] long asset name truncates with ellipsis", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: createMockDebateDetail({
          asset: "VERYLONGASSETNAME12345",
        }),
      }),
    });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
    const serialized = JSON.stringify(ogCalls[0].jsx);
    expect(serialized).toContain("VERYLONGA\u2026");
    expect(serialized).not.toContain("VERYLONGASSETNAME");
  });

  it("[P0][5.1-038] undecided votes show 'undecided' text in debate image", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: createMockDebateDetail({
          totalVotes: 100,
          voteBreakdown: { bull: 40, bear: 30, undecided: 30 },
        }),
      }),
    });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
    expect(isFallbackImage(ogCalls[0].jsx)).toBe(false);
    const serialized = JSON.stringify(ogCalls[0].jsx);
    expect(serialized).toContain("undecided");
    expect(serialized).toMatch(/30/);
  });

  it("[P0][5.1-039] no undecided votes does not show undecided text", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: createMockDebateDetail({
          totalVotes: 100,
          voteBreakdown: { bull: 60, bear: 40, undecided: 0 },
        }),
      }),
    });

    const mod = await loadOGModule();
    await mod.default({
      params: Promise.resolve({ externalId: "test-123" }),
    });

    expect(ogCalls).toHaveLength(1);
    const serialized = JSON.stringify(ogCalls[0].jsx);
    expect(serialized).not.toContain("undecided");
    expect(serialized).toContain("Bull");
    expect(serialized).toContain("Bear");
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
