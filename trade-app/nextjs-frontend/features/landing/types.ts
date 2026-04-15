export interface ActiveDebateSummary {
  id: string;
  asset: string;
  status: string;
  startedAt: string;
  viewerCount: number | null;
}

export interface RecentDebatePreview {
  externalId: string;
  asset: string;
  status: string;
  winner: string;
  totalVotes: number;
  voteBreakdown: { bull: number; bear: number; undecided: number };
  completedAt: string | null;
}

export interface LandingPageData {
  activeDebate: ActiveDebateSummary | null;
  recentDebates: RecentDebatePreview[];
}
