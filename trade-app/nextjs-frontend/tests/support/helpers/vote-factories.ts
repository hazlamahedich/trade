import type { VoteUpdatePayload } from "../../../features/debate/hooks/useDebateSocket";

export function createVotePayload(overrides: Partial<VoteUpdatePayload> = {}): VoteUpdatePayload {
  return {
    debateId: "deb_test",
    totalVotes: 10,
    voteBreakdown: { bull: 7, bear: 3 },
    ...overrides,
  };
}

export function createWsVoteMessage(overrides: Partial<VoteUpdatePayload> = {}) {
  return {
    type: "DEBATE/VOTE_UPDATE" as const,
    payload: createVotePayload(overrides),
    timestamp: new Date().toISOString(),
  };
}
