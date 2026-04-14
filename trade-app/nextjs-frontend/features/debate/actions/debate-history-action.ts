"use server";

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
    if (error instanceof Error) {
      if (error.message.includes("Invalid response shape")) {
        throw new Error(
          "Invalid response shape from debate history API",
        );
      }
      throw new Error(
        `Failed to fetch debate history: ${error.message}`,
      );
    }
    throw new Error("Failed to fetch debate history: Unknown error");
  }
}
