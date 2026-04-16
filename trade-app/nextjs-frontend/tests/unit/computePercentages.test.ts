import { computePercentages } from "../../features/debate/utils/percentages";

describe("computePercentages", () => {
  it("given equal votes, produces 33/33/34 split", () => {
    const result = computePercentages(10, 10, 10);
    expect(result.bullPct + result.bearPct + result.undecidedPct).toBe(100);
    expect(result.bullPct).toBe(33);
    expect(result.undecidedPct).toBe(33);
    expect(result.bearPct).toBe(34);
  });

  it("given zero total votes, produces all zeros", () => {
    const result = computePercentages(0, 0, 0);
    expect(result).toEqual({ bullPct: 0, bearPct: 0, undecidedPct: 0 });
  });

  it("given 100% bull votes, produces 100/0/0", () => {
    const result = computePercentages(100, 0, 0);
    expect(result).toEqual({ bullPct: 100, bearPct: 0, undecidedPct: 0 });
  });

  it("given 50/50 bull/bear with no undecided, produces 50/50/0", () => {
    const result = computePercentages(50, 50, 0);
    expect(result).toEqual({ bullPct: 50, bearPct: 50, undecidedPct: 0 });
  });

  it("given 1/99 split, produces 1/99/0", () => {
    const result = computePercentages(1, 99, 0);
    expect(result).toEqual({ bullPct: 1, bearPct: 99, undecidedPct: 0 });
  });

  it("always sums to exactly 100", () => {
    const cases = [
      [7, 3, 5],
      [33, 33, 34],
      [1, 1, 1],
      [999, 1, 0],
      [0, 0, 1],
      [45, 45, 10],
      [13, 57, 30],
    ];
    for (const [b, be, u] of cases) {
      const result = computePercentages(b, be, u);
      expect(result.bullPct + result.bearPct + result.undecidedPct).toBe(100);
    }
  });

  it("defaults undecidedVotes to 0 when omitted", () => {
    const result = computePercentages(50, 50);
    expect(result).toEqual({ bullPct: 50, bearPct: 50, undecidedPct: 0 });
  });

  it("bearPct is never negative due to Math.max guard", () => {
    const result = computePercentages(99, 1, 1);
    expect(result.bearPct).toBeGreaterThanOrEqual(0);
    expect(result.bullPct + result.bearPct + result.undecidedPct).toBe(100);
  });
});
