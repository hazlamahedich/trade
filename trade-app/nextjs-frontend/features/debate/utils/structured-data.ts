import type { DebateDetailData } from "@/features/debate/types/debate-detail";

function deriveWinner(data: DebateDetailData): string {
  const { bullVotes, bearVotes, undecidedVotes } = extractVoteCounts(data);
  const total = bullVotes + bearVotes + undecidedVotes;

  if (total === 0) return "undecided";
  if (bullVotes > bearVotes && bullVotes >= undecidedVotes) return "bull";
  if (bearVotes > bullVotes && bearVotes >= undecidedVotes) return "bear";
  return "undecided";
}

function extractVoteCounts(data: DebateDetailData) {
  return {
    bullVotes: data.voteBreakdown["bull"] ?? 0,
    bearVotes: data.voteBreakdown["bear"] ?? 0,
    undecidedVotes: data.voteBreakdown["undecided"] ?? 0,
  };
}

interface StructuredData {
  "@context": string;
  "@type": string;
  headline: string;
  datePublished: string;
  dateModified: string;
  author: Array<{
    "@type": string;
    name: string;
    disambiguatingDescription: string;
  }>;
  description: string;
  interactionStatistic: {
    "@type": string;
    interactionType: string;
    userInteractionCount: number;
  };
}

export function generateDebateStructuredData(
  data: DebateDetailData,
): StructuredData {
  const winner = deriveWinner(data);
  const asset = data.asset.toUpperCase();

  const description = `AI debate analysis on ${asset}. Winner: ${winner.charAt(0).toUpperCase() + winner.slice(1)}. ${data.guardianVerdict ?? ""}`.trim();

  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: `Bull vs Bear on ${asset}`,
    datePublished: new Date(data.createdAt).toISOString(),
    dateModified: new Date(data.completedAt ?? data.createdAt).toISOString(),
    author: [
      {
        "@type": "Person",
        name: "Bull Agent",
        disambiguatingDescription: "AI trading analysis agent",
      },
      {
        "@type": "Person",
        name: "Bear Agent",
        disambiguatingDescription: "AI trading analysis agent",
      },
    ],
    description,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/LikeAction",
      userInteractionCount: data.totalVotes,
    },
  };
}

export { deriveWinner };
