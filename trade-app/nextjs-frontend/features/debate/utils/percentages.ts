export interface PercentageBreakdown {
  bullPct: number;
  bearPct: number;
  undecidedPct: number;
}

export function computePercentages(
  bullVotes: number,
  bearVotes: number,
  undecidedVotes: number = 0
): PercentageBreakdown {
  const total = bullVotes + bearVotes + undecidedVotes;

  if (total === 0) {
    return { bullPct: 0, bearPct: 0, undecidedPct: 0 };
  }

  const bullPct = Math.round((bullVotes / total) * 100);
  const undecidedPct = Math.round((undecidedVotes / total) * 100);
  const bearPct = Math.max(0, 100 - bullPct - undecidedPct);

  return { bullPct, bearPct, undecidedPct };
}
