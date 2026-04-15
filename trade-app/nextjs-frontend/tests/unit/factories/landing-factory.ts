import type { ActiveDebateSummary, RecentDebatePreview, LandingPageData } from "@/features/landing/types";

export function createActiveDebateSummary(
  overrides: Partial<ActiveDebateSummary> = {},
): ActiveDebateSummary {
  return {
    id: "deb_test1234",
    asset: "btc",
    status: "active",
    startedAt: "2026-04-15T10:30:00Z",
    viewerCount: null,
    ...overrides,
  };
}

export function createRecentDebatePreview(
  overrides: Partial<RecentDebatePreview> = {},
): RecentDebatePreview {
  return {
    externalId: "deb_hist001",
    asset: "eth",
    status: "completed",
    winner: "bull",
    totalVotes: 120,
    voteBreakdown: { bull: 72, bear: 48, undecided: 0 },
    completedAt: "2026-04-14T12:00:00Z",
    ...overrides,
  };
}

export function createServerActionResult(
  overrides: Partial<LandingPageData> = {},
): LandingPageData {
  return {
    activeDebate: null,
    recentDebates: [],
    ...overrides,
  };
}
