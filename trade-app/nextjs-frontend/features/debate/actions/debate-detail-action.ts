"use server";

import { z } from "zod";
import { notFound } from "next/navigation";
import { getApiBaseUrl } from "@/features/debate/api/debate-history";
import type { DebateDetailData } from "@/features/debate/types/debate-detail";

const transcriptMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const debateDetailSchema = z.object({
  debateId: z.string(),
  asset: z.string(),
  status: z.string(),
  currentTurn: z.number(),
  maxTurns: z.number(),
  guardianVerdict: z.string().nullable(),
  guardianInterruptsCount: z.number(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  totalVotes: z.number(),
  voteBreakdown: z.record(z.string(), z.number()),
  transcript: z.array(transcriptMessageSchema).nullable().optional(),
});

const debateDetailResponseSchema = z.object({
  data: debateDetailSchema,
  error: z
    .object({ code: z.string(), message: z.string() })
    .nullable(),
  meta: z.record(z.unknown()).optional(),
});

export async function getDebateDetail(
  externalId: string,
): Promise<DebateDetailData> {
  const url = new URL(
    `${getApiBaseUrl()}/api/debate/${encodeURIComponent(externalId)}/result`,
  );
  url.searchParams.set("include_transcript", "true");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errorBody = await response.json();
      if (errorBody?.error?.message) {
        detail = `: ${errorBody.error.message}`;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(
      `Failed to fetch debate detail: HTTP ${response.status}${detail}`,
    );
  }

  const json: unknown = await response.json();

  let parsed: z.SafeParseReturnType<unknown, { data: DebateDetailData }>;
  try {
    parsed = debateDetailResponseSchema.safeParse(json);
  } catch {
    throw new Error("Invalid response shape from debate detail API");
  }

  if (!parsed.success) {
    throw new Error("Invalid response shape from debate detail API");
  }

  return {
    ...parsed.data.data,
    transcript: parsed.data.data.transcript ?? null,
  };
}
