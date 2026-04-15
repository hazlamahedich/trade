"use server";

import { getApiBaseUrl } from "@/lib/api/config";
import { fetchWithTimeout, isValidEnvelope } from "@/lib/api/server-action-helpers";
import type { LandingPageData, ActiveDebateSummary, RecentDebatePreview } from "../types";

export async function getLandingPageData(): Promise<LandingPageData> {
  const baseUrl = getApiBaseUrl();

  let activeDebate: ActiveDebateSummary | null = null;
  const activeResult = await fetchWithTimeout(`${baseUrl}/api/debate/active`, {}, 10_000);
  if (activeResult.ok) {
    try {
      const json: unknown = await activeResult.response.json();
      if (isValidEnvelope(json) && json.data !== null) {
        activeDebate = json.data as ActiveDebateSummary;
      }
    } catch (err) {
      console.error("[landing] Failed to parse active debate response:", err);
    }
  } else {
    console.error("[landing] Active debate fetch failed:", activeResult.error);
  }

  let recentDebates: RecentDebatePreview[] = [];
  const recentResult = await fetchWithTimeout(
    `${baseUrl}/api/debate/history?status=completed&size=3`,
    {},
    10_000,
  );
  if (recentResult.ok) {
    try {
      const json: unknown = await recentResult.response.json();
      if (isValidEnvelope(json) && Array.isArray(json.data)) {
        recentDebates = json.data as RecentDebatePreview[];
      }
    } catch (err) {
      console.error("[landing] Failed to parse recent debates response:", err);
    }
  } else {
    console.error("[landing] Recent debates fetch failed:", recentResult.error);
  }

  return { activeDebate, recentDebates };
}
