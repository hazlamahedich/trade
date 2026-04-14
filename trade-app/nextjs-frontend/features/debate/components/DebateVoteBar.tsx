"use client";

interface DebateVoteBarProps {
  bullVotes: number;
  bearVotes: number;
  className?: string;
  bullLabel?: string;
  bearLabel?: string;
}

export function DebateVoteBar({
  bullVotes,
  bearVotes,
  className = "",
  bullLabel = "Bull",
  bearLabel = "Bear",
}: DebateVoteBarProps) {
  const total = bullVotes + bearVotes;

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

  const bullPct = Math.round((bullVotes / total) * 100);
  const bearPct = 100 - bullPct;

  return (
    <div
      className={`w-full ${className}`}
      aria-label={`${bullLabel}: ${bullPct}%, ${bearLabel}: ${bearPct}%`}
    >
      <div className="flex h-2 w-full gap-[2px] rounded-full overflow-hidden">
        <div
          className="bg-emerald-500 rounded-l-full transition-all duration-300"
          style={{ width: `${bullPct}%` }}
        />
        <div
          className="bg-rose-500 rounded-r-full transition-all duration-300"
          style={{ width: `${bearPct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>
          {bullLabel} {bullPct}%
        </span>
        <span>
          {bearLabel} {bearPct}%
        </span>
      </div>
    </div>
  );
}
