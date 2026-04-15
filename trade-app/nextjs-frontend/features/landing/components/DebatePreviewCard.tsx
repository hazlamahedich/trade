import Link from "next/link";
import { VotePreviewBar } from "./VotePreviewBar";
import type { RecentDebatePreview } from "../types";

interface DebatePreviewCardProps {
  debate: RecentDebatePreview;
}

export function DebatePreviewCard({ debate }: DebatePreviewCardProps) {
  const bullVotes = debate.voteBreakdown.bull ?? 0;
  const displayVotes = debate.totalVotes ?? 0;
  const totalVotes = displayVotes || 1;

  const undecidedVotes = debate.voteBreakdown.undecided ?? 0;
  const undecidedPct = Math.round((undecidedVotes / totalVotes) * 100);
  const bullPct = Math.round((bullVotes / totalVotes) * 100);
  const bearPct = Math.max(0, 100 - bullPct - undecidedPct);

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
        <VotePreviewBar bullPct={bullPct} bearPct={bearPct} undecidedPct={undecidedPct} />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>
          {bullPct}% Bull / {bearPct}% Bear{undecidedPct > 0 ? ` / ${undecidedPct}% Undecided` : ""}
        </span>
        <span>{displayVotes} vote{displayVotes !== 1 ? "s" : ""}</span>
      </div>
    </Link>
  );
}
