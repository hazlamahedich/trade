import Link from "next/link";
import { VotePreviewBar } from "./VotePreviewBar";
import type { RecentDebatePreview } from "../types";

interface DebatePreviewCardProps {
  debate: RecentDebatePreview;
}

export function DebatePreviewCard({ debate }: DebatePreviewCardProps) {
  const bullVotes = debate.voteBreakdown.bull ?? 0;
  const totalVotes = debate.totalVotes || 1;

  const bullPct = Math.round((bullVotes / totalVotes) * 100);
  const bearPct = 100 - bullPct;

  const winnerLabel =
    debate.winner === "bull"
      ? "Bull wins"
      : debate.winner === "bear"
        ? "Bear wins"
        : "Undecided";

  const winnerColor =
    debate.winner === "bull"
      ? "text-emerald-400"
      : debate.winner === "bear"
        ? "text-rose-400"
        : "text-slate-400";

  return (
    <Link
      href={`/debates/${debate.externalId}`}
      className="block rounded-lg bg-slate-800 border border-white/15 p-5 transition-colors hover:border-white/25 min-h-[44px]"
      data-testid="debate-preview-card"
    >
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold text-white">
          {debate.asset.toUpperCase()}
        </span>
        <span className={`text-sm font-medium ${winnerColor}`}>
          {winnerLabel}
        </span>
      </div>

      <div className="mt-3">
        <VotePreviewBar bullPct={bullPct} bearPct={bearPct} />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>
          {bullPct}% Bull / {bearPct}% Bear
        </span>
        <span>{totalVotes} votes</span>
      </div>
    </Link>
  );
}
