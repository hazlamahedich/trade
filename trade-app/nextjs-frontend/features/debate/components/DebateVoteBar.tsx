"use client";

import { computePercentages } from "../utils/percentages";

interface DebateVoteBarProps {
  bullVotes: number;
  bearVotes: number;
  undecidedVotes?: number;
  className?: string;
  bullLabel?: string;
  bearLabel?: string;
  undecidedLabel?: string;
}

export function DebateVoteBar({
  bullVotes,
  bearVotes,
  undecidedVotes = 0,
  className = "",
  bullLabel = "Bull",
  bearLabel = "Bear",
  undecidedLabel = "Undecided",
}: DebateVoteBarProps) {
  const total = bullVotes + bearVotes + undecidedVotes;

  if (total === 0) {
    return (
      <div
        className={`w-full ${className}`}
        aria-label="No votes yet"
      >
        <div className="h-2 w-full rounded-full bg-white/10" />
        <p className="mt-1 text-xs text-slate-400">No votes</p>
      </div>
    );
  }

  const { bullPct, bearPct, undecidedPct } = computePercentages(bullVotes, bearVotes, undecidedVotes);

  return (
    <div
      className={`w-full ${className}`}
      aria-label={`${bullLabel}: ${bullPct}%, ${bearLabel}: ${bearPct}%, ${undecidedLabel}: ${undecidedPct}%`}
    >
      <div className="flex h-2 w-full gap-[2px] rounded-full overflow-hidden">
        <div
          className="bg-emerald-500 rounded-l-full transition-all duration-300 motion-reduce:transition-none"
          style={{ width: `${bullPct}%` }}
        />
        <div
          className="bg-rose-500 transition-all duration-300 motion-reduce:transition-none"
          style={{ width: `${bearPct}%` }}
        />
        <div
          className="bg-slate-600 rounded-r-full transition-all duration-300 motion-reduce:transition-none"
          style={{ width: `${undecidedPct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>
          {bullLabel} {bullPct}%
        </span>
        {undecidedPct > 0 && (
          <span>
            {undecidedLabel} {undecidedPct}%
          </span>
        )}
        <span>
          {bearLabel} {bearPct}%
        </span>
      </div>
    </div>
  );
}
