import { computePercentages } from "@/features/debate/utils/percentages";
import { deriveWinner } from "@/features/debate/utils/structured-data";
import { createMockDebateDetail } from "./factories/debate-detail-factory";

function inlineExtractVotes(
  voteBreakdown: Record<string, number> | null | undefined,
) {
  if (!voteBreakdown)
    return { bullVotes: 0, bearVotes: 0, undecidedVotes: 0 };
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

describe("[P0][5.1] inline computePercentages contract", () => {
  const cases = [
    { bull: 60, bear: 40, undecided: 0, label: "simple majority" },
    { bull: 0, bear: 0, undecided: 0, label: "zero votes" },
    { bull: 50, bear: 50, undecided: 0, label: "tie votes" },
    { bull: 33, bear: 33, undecided: 34, label: "three-way split" },
    { bull: 99, bear: 1, undecided: 0, label: "landslide" },
    { bull: 1, bear: 1, undecided: 0, label: "single votes each" },
    {
      bull: 1000,
      bear: 500,
      undecided: 500,
      label: "large numbers",
    },
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

  it("[P2][5.1-032] three-way near-equal split matches shared and sums to 100", () => {
    const inline = inlineComputePercentages(33, 33, 34);
    const shared = computePercentages(33, 33, 34);
    expect(inline).toEqual(shared);
    expect(inline.bullPct + inline.bearPct + inline.undecidedPct).toBe(100);
  });

  it("[P2][5.1-033] very large vote counts match shared utility", () => {
    const inline = inlineComputePercentages(1_000_000, 500_000, 500_000);
    const shared = computePercentages(1_000_000, 500_000, 500_000);
    expect(inline).toEqual(shared);
    expect(inline.bullPct + inline.bearPct + inline.undecidedPct).toBe(100);
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

  it("[P2][5.1-031] bull-undecided tie matches shared utility", () => {
    const data = createMockDebateDetail({
      voteBreakdown: { bull: 40, bear: 20, undecided: 40 },
    });
    const result = inlineDeriveWinner(data);
    expect(result).toBe("bull");
    expect(result).toBe(deriveWinner(data));
  });

  it("[P2][5.1-035] single undecided vote matches shared utility", () => {
    const data = createMockDebateDetail({
      voteBreakdown: { bull: 0, bear: 0, undecided: 1 },
    });
    const result = inlineDeriveWinner(data);
    expect(result).toBe("undecided");
    expect(result).toBe(deriveWinner(data));
  });
});

describe("[P0][5.1] inline extractVotes edge cases", () => {
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

  it("[P0][5.1-011] empty voteBreakdown produces undecided winner matching shared", () => {
    const data = createMockDebateDetail({ voteBreakdown: {} });
    const result = inlineDeriveWinner(data);
    expect(result).toBe("undecided");
    expect(result).toBe(deriveWinner(data));
  });

  it("[P0][5.1-014] active debate with empty voteBreakdown matches shared", () => {
    const activeData = createMockDebateDetail({
      status: "in_progress",
      voteBreakdown: {},
      totalVotes: 0,
      completedAt: null,
    });
    expect(inlineDeriveWinner(activeData)).toBe(deriveWinner(activeData));
    expect(inlineDeriveWinner(activeData)).toBe("undecided");

    const pcts = inlineComputePercentages(0, 0, 0);
    const shared = computePercentages(0, 0, 0);
    expect(pcts).toEqual(shared);
    expect(pcts).toEqual({ bullPct: 0, bearPct: 0, undecidedPct: 0 });
  });
});
