"use server";

import { z, ZodError } from "zod";
import { fetchDebateHistory, type DebateHistoryResponse } from "@/features/debate/api/debate-history";
import { VALID_OUTCOMES } from "@/features/debate/types/debate-history";

const getDebateHistoryParamsSchema = z.object({
  page: z.number().int().min(1),
  size: z.number().int().min(1),
  asset: z.string().optional(),
  outcome: z.enum(VALID_OUTCOMES).optional(),
});

export type GetDebateHistoryParams = z.input<typeof getDebateHistoryParamsSchema>;

export async function getDebateHistory(
  params: GetDebateHistoryParams,
): Promise<DebateHistoryResponse> {
  const validated = getDebateHistoryParamsSchema.parse(params);

  try {
    return await fetchDebateHistory(validated);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        "Invalid response shape from debate history API",
      );
    }
    if (!(error instanceof Error)) {
      throw new Error("Failed to fetch debate history: Unknown error");
    }
    throw error;
  }
}
