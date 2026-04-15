export interface TranscriptMessage {
  role: string;
  content: string;
}

export interface DebateDetailData {
  debateId: string;
  asset: string;
  status: string;
  currentTurn: number;
  maxTurns: number;
  guardianVerdict: string | null;
  guardianInterruptsCount: number;
  createdAt: string;
  completedAt: string | null;
  totalVotes: number;
  voteBreakdown: Record<string, number>;
  transcript: TranscriptMessage[] | null;
}
