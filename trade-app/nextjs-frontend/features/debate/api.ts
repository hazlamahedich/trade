const VOTE_TIMEOUT_MS = 10_000;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface VoteRequest {
  debateId: string;
  choice: "bull" | "bear" | "undecided";
  voterFingerprint: string;
}

export interface VoteResponseData {
  voteId: string;
  debateId: string;
  choice: string;
  voterFingerprint: string;
  createdAt: string;
}

export interface VoteError {
  code: string;
  message: string;
}

export interface VoteMeta {
  latencyMs: number;
  isFinal?: boolean;
  retryAfterMs?: number;
  estimatedWaitMs?: number;
}

export interface VoteSuccessEnvelope {
  data: VoteResponseData;
  error: null;
  meta: VoteMeta;
}

export interface VoteErrorEnvelope {
  data: null;
  error: VoteError;
  meta: Record<string, unknown>;
}

export type VoteEnvelope = VoteSuccessEnvelope | VoteErrorEnvelope;

export interface DebateResultData {
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
}

export interface DebateResultEnvelope {
  data: DebateResultData;
  error: null;
  meta: Record<string, unknown>;
}

function isVoteErrorEnvelope(body: VoteEnvelope): body is VoteErrorEnvelope {
  return body.error !== null && body.data === null;
}

function parseJsonSafely(response: Response): Promise<VoteEnvelope> {
  return response.text().then((text) => {
    try {
      return JSON.parse(text) as VoteEnvelope;
    } catch {
      return {
        data: null,
        error: { code: "INVALID_RESPONSE", message: `Server returned non-JSON response (${response.status})` },
        meta: {},
      } as VoteEnvelope;
    }
  });
}

export async function submitVote(request: VoteRequest): Promise<VoteSuccessEnvelope> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VOTE_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/api/debate/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    const body = await parseJsonSafely(response);

    if (!response.ok || isVoteErrorEnvelope(body)) {
      const error: VoteError = body.error ?? {
        code: "UNKNOWN_ERROR",
        message: `Vote failed with status ${response.status}`,
      };
      const errorWithStatus = Object.assign(new Error(error.message), {
        code: error.code,
        status: response.status,
        meta: body.meta ?? {},
      }) as VoteApiError;
      throw errorWithStatus;
    }

    return body;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw Object.assign(new Error("Vote request timed out. Please try again."), {
        code: "TIMEOUT",
        status: 0,
        meta: {},
      }) as VoteApiError;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchDebateResult(debateId: string): Promise<DebateResultEnvelope> {
  const response = await fetch(`${API_BASE_URL}/api/debate/${debateId}/result`);

  if (!response.ok) {
    throw Object.assign(new Error(`Failed to fetch debate result: ${response.status}`), {
      status: response.status,
    }) as VoteApiError;
  }

  return response.json();
}

export function getOrCreateVoterFingerprint(): string {
  if (typeof window === "undefined") return "";

  const KEY = "voter_fingerprint";
  const existing = sessionStorage.getItem(KEY);
  if (existing) return existing;

  const fingerprint = crypto.randomUUID();
  sessionStorage.setItem(KEY, fingerprint);
  return fingerprint;
}

export type VoteApiError = Error & {
  code?: string;
  status?: number;
  meta?: Record<string, unknown>;
};
