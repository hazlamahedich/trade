"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SentimentRevealProps {
  voteBreakdown: Record<string, number> | null;
  totalVotes: number;
}

export function SentimentReveal({ voteBreakdown, totalVotes }: SentimentRevealProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement>(null);

  const bullVotes = voteBreakdown?.bull ?? 0;
  const bearVotes = voteBreakdown?.bear ?? 0;

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  if (totalVotes === 0) {
    return (
      <div
        ref={containerRef}
        data-testid="sentiment-reveal"
        aria-live="polite"
        role="region"
        tabIndex={-1}
        aria-label="Debate sentiment results"
        className="bg-slate-900/80 backdrop-blur-md border-t border-white/10 p-4"
      >
        <p className="text-center text-sm text-slate-400">No votes yet</p>
      </div>
    );
  }

  const bullPct = totalVotes > 0 ? Math.round((bullVotes / totalVotes) * 100) : 0;
  const bearPct = totalVotes > 0 ? Math.round((bearVotes / totalVotes) * 100) : 0;
  const otherPct = 100 - bullPct - bearPct;

  return (
    <div
      ref={containerRef}
      data-testid="sentiment-reveal"
      aria-live="polite"
      role="region"
      tabIndex={-1}
      aria-label={`Bull: ${bullPct}%, Bear: ${bearPct}%`}
      className="bg-slate-900/80 backdrop-blur-md border-t border-white/10 p-4 outline-none"
    >
      <div className="flex justify-between text-xs mb-1">
        <span className="text-emerald-400 font-semibold">
          Bull {bullPct}%
        </span>
        <span className="text-slate-400">{totalVotes} votes</span>
        <span className="text-rose-400 font-semibold">
          Bear {bearPct}%
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden bg-slate-700 flex"
        role="img"
        aria-label={`Bull: ${bullPct}%, Bear: ${bearPct}%${otherPct > 0 ? `, Other: ${otherPct}%` : ""}`}
      >
        <div
          className={cn(
            "bg-emerald-500",
            shouldReduceMotion ? "" : "transition-all duration-500 ease-out",
          )}
          style={{ width: `${bullPct}%` }}
        />
        {otherPct > 0 && (
          <div
            className="bg-slate-500"
            style={{ width: `${otherPct}%` }}
          />
        )}
        <div
          className={cn(
            "bg-rose-500",
            shouldReduceMotion ? "" : "transition-all duration-500 ease-out",
          )}
          style={{ width: `${bearPct}%` }}
        />
      </div>
    </div>
  );
}
