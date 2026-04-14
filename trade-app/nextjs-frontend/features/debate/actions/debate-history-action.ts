"use server";

import { ZodError } from "zod";
import { fetchDebateHistory } from "@/features/debate/api/debate-history";
import type { StandardDebateHistoryResponse } from "@/features/debate/types/debate-history";

interface GetDebateHistoryParams {
  page: number;
  size: number;
  asset?: string;
  outcome?: string;
}

export async function getDebateHistory(
  params: GetDebateHistoryParams,
): Promise<StandardDebateHistoryResponse> {
  try {
    const response = await fetchDebateHistory(params);
    return response as StandardDebateHistoryResponse;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        "Invalid response shape from debate history API",
      );
    }
    if (error instanceof Error) {
      throw new Error(
        `Failed to fetch debate history: ${error.message}`,
      );
    }
    throw new Error("Failed to fetch debate history: Unknown error");
  }
}
