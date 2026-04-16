export type { DebateMessage, ArgumentMessage } from "../hooks/useDebateMessages";

export interface SnapshotVoteData {
  bullVotes: number;
  bearVotes: number;
  undecidedVotes?: number;
}

export interface SnapshotInput {
  debateId: string;
  assetName: string;
  externalId: string;
  messages: import("../hooks/useDebateMessages").DebateMessage[];
  voteData: SnapshotVoteData;
  timestamp?: string;
}

export type SnapshotState = "idle" | "generating" | "error" | "success";
