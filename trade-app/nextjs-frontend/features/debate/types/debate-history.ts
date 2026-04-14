export interface DebateHistoryItem {
  externalId: string;
  asset: string;
  status: string;
  guardianVerdict: string | null;
  guardianInterruptsCount: number;
  totalVotes: number;
  voteBreakdown: Record<string, number>;
  winner: string;
  createdAt: string;
  completedAt: string | null;
}

export interface DebateHistoryMeta {
  page: number;
  size: number;
  total: number;
  pages: number;
}

export interface StandardDebateHistoryResponse {
  data: DebateHistoryItem[];
  error: { code: string; message: string } | null;
  meta: DebateHistoryMeta;
}

export type WinnerType = "bull" | "bear" | "undecided";
export type OutcomeFilter = "bull" | "bear" | "";
export type AssetFilter = string;

// Keep in sync with backend SUPPORTED_ASSETS / VALID_OUTCOMES in app/routes/debate.py
export const SUPPORTED_ASSETS = [
  "btc",
  "eth",
  "sol",
  "bitcoin",
  "ethereum",
  "solana",
] as const;

export const VALID_OUTCOMES = ["bull", "bear", "undecided"] as const;
