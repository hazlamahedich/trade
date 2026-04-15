import type { DebateDetailData, TranscriptMessage } from "@/features/debate/types/debate-detail";

const FIXED_NOW = "2026-04-14T12:00:00.000Z";

export function createMockDebateDetail(
  overrides: Partial<DebateDetailData> = {},
): DebateDetailData {
  return {
    debateId: "test-123",
    asset: "btc",
    status: "completed",
    currentTurn: 6,
    maxTurns: 6,
    guardianVerdict: null,
    guardianInterruptsCount: 0,
    createdAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    totalVotes: 100,
    voteBreakdown: { bull: 60, bear: 40, undecided: 0 },
    transcript: null,
    ...overrides,
  };
}

export function createMockTranscriptMessage(
  role: string = "bull",
  content: string = "Test argument content",
): TranscriptMessage {
  return { role, content };
}
