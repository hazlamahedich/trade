"use server";

import { getApiBaseUrl } from "@/lib/api/config";
import { fetchWithTimeout, isValidEnvelope } from "@/lib/api/server-action-helpers";
import type { LandingPageData } from "../types";

export async function getLandingPageData(): Promise<LandingPageData> {
  const baseUrl = getApiBaseUrl();

  const result = await fetchWithTimeout(`${baseUrl}/api/landing`, {}, 4_000);

  if (result.ok) {
    try {
      const json: unknown = await result.response.json();
      if (isValidEnvelope(json) && json.data !== null) {
        const data = json.data as {
          activeDebate: LandingPageData["activeDebate"];
          recentDebates: LandingPageData["recentDebates"];
        };
        return {
          activeDebate: data.activeDebate ?? null,
          recentDebates: Array.isArray(data.recentDebates) ? data.recentDebates : [],
        };
      }
    } catch (err) {
      console.error("[landing] Failed to parse landing data response:", err);
    }
  } else {
    console.error("[landing] Landing data fetch failed:", result.error);
  }

  return { activeDebate: null, recentDebates: [] };
}
