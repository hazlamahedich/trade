import { z } from "zod";

const debateHistoryItemSchema = z.object({
  externalId: z.string(),
  asset: z.string(),
  status: z.string(),
  guardianVerdict: z.string().nullable(),
  guardianInterruptsCount: z.number(),
  totalVotes: z.number(),
  voteBreakdown: z.record(z.string(), z.number()),
  winner: z.string(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

const debateHistoryResponseSchema = z.object({
  data: z.array(debateHistoryItemSchema),
  error: z
    .object({ code: z.string(), message: z.string() })
    .nullable(),
  meta: z.object({
    page: z.number().int().positive(),
    size: z.number().int().positive(),
    total: z.number().int().min(0),
    pages: z.number().int().min(0),
  }),
});

export type DebateHistoryResponse = z.infer<
  typeof debateHistoryResponseSchema
>;

export function getApiBaseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (!url) {
    throw new Error("API_BASE_URL env var is not set");
  }
  return url;
}

export function extractVotes(voteBreakdown: Record<string, number>): {
  bullVotes: number;
  bearVotes: number;
  undecidedVotes: number;
} {
  const bullVotes = voteBreakdown["bull"] ?? 0;
  const bearVotes = voteBreakdown["bear"] ?? 0;
  const undecidedVotes = voteBreakdown["undecided"] ?? 0;

  if (bullVotes === 0 && bearVotes === 0) {
    console.warn(
      "voteBreakdown has neither 'bull' nor 'bear' keys:",
      voteBreakdown,
    );
  }

  return { bullVotes, bearVotes, undecidedVotes };
}

interface FetchDebateHistoryParams {
  page: number;
  size: number;
  asset?: string;
  outcome?: string;
}

export async function fetchDebateHistory(
  params: FetchDebateHistoryParams,
): Promise<DebateHistoryResponse> {
  const url = new URL(`${getApiBaseUrl()}/api/debate/history`);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("size", String(params.size));
  if (params.asset) url.searchParams.set("asset", params.asset);
  if (params.outcome) url.searchParams.set("outcome", params.outcome);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch debate history: HTTP ${response.status}`,
    );
  }

  const json: unknown = await response.json();
  return debateHistoryResponseSchema.parse(json);
}
