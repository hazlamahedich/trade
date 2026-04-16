import { computePercentages } from "@/features/debate/utils/percentages";

describe("[P0][5.1] computePercentages canonical correctness", () => {
  const canonicalCases = [
    {
      bull: 60,
      bear: 40,
      undecided: 0,
      expected: { bullPct: 60, bearPct: 40, undecidedPct: 0 },
      label: "simple majority",
    },
    {
      bull: 0,
      bear: 0,
      undecided: 0,
      expected: { bullPct: 0, bearPct: 0, undecidedPct: 0 },
      label: "zero votes",
    },
    {
      bull: 50,
      bear: 50,
      undecided: 0,
      expected: { bullPct: 50, bearPct: 50, undecidedPct: 0 },
      label: "tie votes",
    },
    {
      bull: 33,
      bear: 33,
      undecided: 34,
      expected: { bullPct: 33, bearPct: 33, undecidedPct: 34 },
      label: "three-way split",
    },
    {
      bull: 99,
      bear: 1,
      undecided: 0,
      expected: { bullPct: 99, bearPct: 1, undecidedPct: 0 },
      label: "landslide",
    },
    {
      bull: 1,
      bear: 1,
      undecided: 0,
      expected: { bullPct: 50, bearPct: 50, undecidedPct: 0 },
      label: "single votes each",
    },
    {
      bull: 67,
      bear: 33,
      undecided: 0,
      expected: { bullPct: 67, bearPct: 33, undecidedPct: 0 },
      label: "two-thirds majority",
    },
    {
      bull: 34,
      bear: 33,
      undecided: 33,
      expected: { bullPct: 34, bearPct: 33, undecidedPct: 33 },
      label: "near-equal three-way (original bug case)",
    },
    {
      bull: 1,
      bear: 0,
      undecided: 0,
      expected: { bullPct: 100, bearPct: 0, undecidedPct: 0 },
      label: "single bull vote",
    },
    {
      bull: 0,
      bear: 0,
      undecided: 1,
      expected: { bullPct: 0, bearPct: 0, undecidedPct: 100 },
      label: "single undecided vote",
    },
  ];

  canonicalCases.forEach(({ bull, bear, undecided, expected, label }) => {
    it(`[P0][5.1-CANON] produces correct output for: ${label}`, () => {
      const result = computePercentages(bull, bear, undecided);
      expect(result).toEqual(expected);
    });
  });

  it("[P0][5.1-CANON] percentages sum to 100 for all non-zero cases", () => {
    const nonZeroCases = canonicalCases.filter(
      (c) => c.bull + c.bear + c.undecided > 0,
    );
    nonZeroCases.forEach(({ bull, bear, undecided }) => {
      const result = computePercentages(bull, bear, undecided);
      const sum = result.bullPct + result.bearPct + result.undecidedPct;
      expect(sum).toBe(100);
    });
  });

  it("[P0][5.1-CANON] zero votes sum to 0", () => {
    const result = computePercentages(0, 0, 0);
    expect(result.bullPct + result.bearPct + result.undecidedPct).toBe(0);
  });
});

describe("[P0][5.1] inlineComputeBarPercentages canonical correctness", () => {
  function inlineComputeBarPercentages(bullVotes: number, bearVotes: number) {
    const committedTotal = bullVotes + bearVotes;
    if (committedTotal === 0) return { barBullPct: 50, barBearPct: 50 };
    const barBullPct = Math.round((bullVotes / committedTotal) * 100);
    const barBearPct = 100 - barBullPct;
    return { barBullPct, barBearPct };
  }

  const barCases = [
    { bull: 60, bear: 40, expected: { barBullPct: 60, barBearPct: 40 }, label: "simple majority" },
    { bull: 50, bear: 50, expected: { barBullPct: 50, barBearPct: 50 }, label: "tie" },
    { bull: 99, bear: 1, expected: { barBullPct: 99, barBearPct: 1 }, label: "landslide" },
    { bull: 1, bear: 1, expected: { barBullPct: 50, barBearPct: 50 }, label: "single votes" },
    { bull: 0, bear: 0, expected: { barBullPct: 50, barBearPct: 50 }, label: "zero committed" },
    { bull: 1, bear: 0, expected: { barBullPct: 100, barBearPct: 0 }, label: "only bull" },
    { bull: 0, bear: 1, expected: { barBullPct: 0, barBearPct: 100 }, label: "only bear" },
  ];

  barCases.forEach(({ bull, bear, expected, label }) => {
    it(`[P0][5.1-CANON] bar percentages correct for: ${label}`, () => {
      const result = inlineComputeBarPercentages(bull, bear);
      expect(result).toEqual(expected);
    });
  });

  it("[P0][5.1-CANON] bar percentages always sum to 100", () => {
    barCases.forEach(({ bull, bear }) => {
      const result = inlineComputeBarPercentages(bull, bear);
      expect(result.barBullPct + result.barBearPct).toBe(100);
    });
  });
});
