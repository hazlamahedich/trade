import type { DebateHistoryItem } from "@/features/debate/types/debate-history";

const FIXED_NOW = "2026-04-14T12:00:00Z";

export function createDebateHistoryItem(
  overrides: Partial<DebateHistoryItem> = {},
): DebateHistoryItem {
  return {
    externalId: "test-123",
    asset: "btc",
    status: "completed",
    guardianVerdict: null,
    guardianInterruptsCount: 0,
    totalVotes: 100,
    voteBreakdown: { bull: 60, bear: 40, undecided: 0 },
    winner: "bull",
    createdAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    ...overrides,
  };
}
