"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface SentimentRevealProps {
  voteBreakdown: Record<string, number> | null;
  totalVotes: number;
}

export function SentimentReveal({ voteBreakdown, totalVotes }: SentimentRevealProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  const bullVotes = voteBreakdown?.bull ?? 0;
  const bearVotes = voteBreakdown?.bear ?? 0;

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
        <p data-testid="sentiment-empty-state" className="text-center text-sm text-slate-400">
          Be the first to vote
        </p>
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
        <AnimatePresence mode="popLayout">
          <motion.span
            key={totalVotes}
            data-testid="sentiment-vote-count"
            className="text-slate-400"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
          >
            {totalVotes} votes
          </motion.span>
        </AnimatePresence>
        <span className="text-rose-400 font-semibold">
          Bear {bearPct}%
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden bg-slate-700 flex"
        role="img"
        aria-label={`Bull: ${bullPct}%, Bear: ${bearPct}%${otherPct > 0 ? `, Other: ${otherPct}%` : ""}`}
      >
        <motion.div
          data-testid="bull-bar"
          className="h-2 bg-emerald-500"
          initial={{ width: "0%" }}
          animate={{ width: `${bullPct}%` }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.3,
            ease: "easeOut",
          }}
        />
        {otherPct > 0 && (
          <motion.div
            data-testid="other-bar"
            className="h-2 bg-slate-500"
            initial={{ width: "0%" }}
            animate={{ width: `${otherPct}%` }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.3,
              ease: "easeOut",
              delay: (shouldReduceMotion || !isFirstRender.current) ? 0 : 0.15,
            }}
          />
        )}
        <motion.div
          data-testid="bear-bar"
          className="h-2 bg-rose-500"
          initial={{ width: "0%" }}
          animate={{ width: `${bearPct}%` }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.3,
            ease: "easeOut",
            delay: (shouldReduceMotion || !isFirstRender.current) ? 0 : 0.15,
          }}
        />
      </div>
    </div>
  );
}
