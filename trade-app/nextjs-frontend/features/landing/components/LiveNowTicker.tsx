"use client";

import Link from "next/link";
import type { ActiveDebateSummary } from "../types";

interface LiveNowTickerProps {
  activeDebate: ActiveDebateSummary | null;
}

type TickerState = "live" | "scheduled" | "empty";

function getTickerState(data: ActiveDebateSummary | null): TickerState {
  if (data !== null && data.status === "active") return "live";
  if (data !== null && data.status === "scheduled") return "scheduled";
  return "empty";
}

export function LiveNowTicker({ activeDebate }: LiveNowTickerProps) {
  const state = getTickerState(activeDebate);

  return (
    <div
      className="flex items-center justify-center px-6 py-4"
      aria-live="polite"
      role="status"
      data-testid="live-now-ticker"
    >
      {state === "live" && activeDebate && (
        <Link
          href={`/debates/${activeDebate.id}`}
          className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-5 py-3 transition-colors hover:bg-emerald-500/20 min-h-[44px]"
        >
          <span
            className="relative flex h-3 w-3"
            aria-hidden="true"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">
            LIVE
          </span>
          <span className="text-sm text-slate-300">
            {activeDebate.asset.toUpperCase()} Bull vs Bear
          </span>
        </Link>
      )}

      {state === "scheduled" && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-700 px-5 py-3 min-h-[44px]">
          <span className="text-sm text-slate-400">
            No upcoming debates right now.
          </span>
          <Link
            href="/debates"
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Start one
          </Link>
        </div>
      )}

      {state === "empty" && (
        <Link
          href="/debates"
          className="flex items-center gap-3 rounded-lg border border-slate-700 px-5 py-3 transition-colors hover:border-slate-600 min-h-[44px]"
        >
          <span className="text-sm text-slate-300">
            The arena is resting. Start the first debate.
          </span>
        </Link>
      )}
    </div>
  );
}
