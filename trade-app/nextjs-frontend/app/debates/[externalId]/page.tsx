import { Metadata } from "next";
import { Shield } from "lucide-react";

import { DEBATE_DETAIL_ISR_REVALIDATE_SECONDS } from "@/lib/config/isr";
import { getDebateDetail } from "@/features/debate/actions/debate-detail-action";
import { DebateVoteBar } from "@/features/debate/components/DebateVoteBar";
import { DebateTranscript } from "@/features/debate/components/DebateTranscript";
import { ArchivedBadge } from "@/features/debate/components/ArchivedBadge";
import { BackToHistoryLink, DebateDetailActions } from "@/features/debate/components/DebateDetailClientActions";
import { extractVotes } from "@/features/debate/api/debate-history";
import { getWinnerBadge } from "@/features/debate/utils/winner-badge";
import { generateDebateStructuredData, deriveWinner } from "@/features/debate/utils/structured-data";

export const revalidate = DEBATE_DETAIL_ISR_REVALIDATE_SECONDS;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ externalId: string }>;
}): Promise<Metadata> {
  const { externalId } = await params;
  let data;
  try {
    data = await getDebateDetail(externalId);
  } catch {
    return { title: "Debate Not Found" };
  }

  const asset = data.asset.toUpperCase().slice(0, 30);
  const winner = deriveWinner(data);
  const winnerLabel =
    winner.charAt(0).toUpperCase() + winner.slice(1);

  const title = `Bull vs Bear on ${asset} — AI Trading Debate Lab`;
  const description = `AI debate analysis on ${asset}. ${winnerLabel} won with ${data.totalVotes} votes. ${data.guardianVerdict ?? ""}`.trim();

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `/debates/${externalId}`,
      siteName: "AI Trading Debate Lab",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/debates/${externalId}/opengraph-image`],
    },
  };
}

export default async function DebateDetailPage({
  params,
}: {
  params: Promise<{ externalId: string }>;
}) {
  const { externalId } = await params;
  const data = await getDebateDetail(externalId);

  const winner = deriveWinner(data);
  const badge = getWinnerBadge(winner);
  const votes = extractVotes(data.voteBreakdown);
  const structuredData = generateDebateStructuredData(data);

  return (
    <main className="min-h-screen bg-background text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/<\/script/gi, "<\\/script"),
        }}
      />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <BackToHistoryLink />

        <section aria-label="Debate summary">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-slate-100">
              {data.asset.toUpperCase()}
            </h1>
            <ArchivedBadge winner={winner} />
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${badge.colorClass}`}
            >
              <span aria-hidden="true">{badge.icon}</span>
              {badge.label}
            </span>
            <span className="text-sm text-slate-400">
              {data.totalVotes} votes
            </span>
          </div>

          <div className="mb-4">
            <DebateVoteBar
              bullVotes={votes.bullVotes}
              bearVotes={votes.bearVotes}
              undecidedVotes={votes.undecidedVotes}
            />
          </div>

          <DebateDetailActions externalId={externalId} assetName={data.asset} debateStatus={data.status as "active" | "completed" | undefined} />
        </section>

        {data.guardianVerdict && (
          <section
            className="mt-8 rounded-lg border border-glass bg-white/5 p-4"
            aria-label="Guardian verdict"
          >
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-300">
                Guardian Verdict
              </h2>
            </div>
            <p className="text-sm text-slate-200">{data.guardianVerdict}</p>
          </section>
        )}

        <section className="mt-8" aria-label="Debate transcript">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">
            Debate Transcript
          </h2>
          <DebateTranscript messages={data.transcript} />
        </section>

        <footer className="mt-8 pt-6 border-t border-glass text-sm text-slate-400">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <p>
                Created:{" "}
                {new Date(data.createdAt).toLocaleString()}
              </p>
              {data.completedAt && (
                <p>
                  Completed:{" "}
                  {new Date(data.completedAt).toLocaleString()}
                </p>
              )}
            </div>
            <p>{data.totalVotes} total votes</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
