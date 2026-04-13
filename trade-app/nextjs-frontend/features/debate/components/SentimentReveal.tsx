"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export type OptimisticSegment = "bull" | "bear" | null;
export type OptimisticStatus = "pending" | "confirmed" | "failed" | "timeout";

const celebratedDebates = new Set<string>();

interface SentimentRevealProps {
  voteBreakdown: Record<string, number> | null;
  totalVotes: number;
  optimisticSegment?: OptimisticSegment;
  optimisticStatus?: OptimisticStatus;
  isFirstVoter?: boolean;
  debateId?: string;
}

function BarSegment({
  testId,
  pct,
  colorClass,
  delay,
  shouldReduceMotion,
  isOptimistic,
  optimisticStatus,
}: {
  testId: string;
  pct: number;
  colorClass: string;
  delay: number;
  shouldReduceMotion: boolean;
  isOptimistic: boolean;
  optimisticStatus?: OptimisticStatus;
}) {
  const showShimmer = isOptimistic && optimisticStatus === "pending" && !shouldReduceMotion;
  const opacity = isOptimistic
    ? optimisticStatus === "timeout"
      ? 0.6
      : optimisticStatus === "pending"
        ? 0.85
        : 1
    : 1;

  return (
    <motion.div
      data-testid={testId}
      className={`h-2 ${colorClass} relative overflow-hidden`}
      style={{ opacity }}
      initial={{ width: "0%" }}
      animate={{ width: `${pct}%` }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.3,
        ease: "easeOut",
        delay,
      }}
    >
      {showShimmer && (
        <div
          data-testid={`${testId}-shimmer`}
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "optimism-shimmer 2s ease-in-out infinite",
          }}
        />
      )}
    </motion.div>
  );
}

function FirstVoterBadge({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  const [showCelebration, setShowCelebration] = useState(true);

  useEffect(() => {
    if (!showCelebration) return;
    const timer = setTimeout(() => setShowCelebration(false), 2000);
    return () => clearTimeout(timer);
  }, [showCelebration]);

  if (!showCelebration) return null;

  return (
    <>
      <motion.div
        data-testid="first-voter-badge"
        className="text-center text-xs mt-2 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20 inline-block"
        initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.95, opacity: 0 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.5 }}
      >
        First vote cast
      </motion.div>
      <div aria-live="polite" className="sr-only">
        You are the first to vote!
      </div>
    </>
  );
}

export function SentimentReveal({
  voteBreakdown,
  totalVotes,
  optimisticSegment = null,
  optimisticStatus,
  isFirstVoter = false,
  debateId,
}: SentimentRevealProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const showBadge = isFirstVoter && totalVotes === 1 && debateId && !celebratedDebates.has(debateId);

  useEffect(() => {
    if (showBadge && debateId) {
      celebratedDebates.add(debateId);
    }
  }, [showBadge, debateId]);

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
        <style>{`@keyframes optimism-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
        <p data-testid="sentiment-empty-state" className="text-center text-sm text-slate-400">
          Be the first to vote
        </p>
      </div>
    );
  }

  const bullPct = totalVotes > 0 ? Math.round((bullVotes / totalVotes) * 100) : 0;
  const otherVotes = totalVotes - bullVotes - bearVotes;
  const otherPct = otherVotes > 0 ? Math.round((otherVotes / totalVotes) * 100) : 0;
  const bearPct = 100 - bullPct - otherPct;

  const staggerDelay = (shouldReduceMotion || !isFirstRender.current) ? 0 : 0.15;

  const ariaLabel =
    optimisticStatus === "pending"
      ? "Your vote is being recorded"
      : optimisticStatus === "failed"
        ? "Your vote was updated"
        : optimisticStatus === "timeout"
          ? "Your vote is still being processed"
          : `Bull: ${bullPct}%, Bear: ${bearPct}%`;

  return (
    <div
      ref={containerRef}
      data-testid="sentiment-reveal"
      aria-live="polite"
      role="region"
      tabIndex={-1}
      aria-label={ariaLabel}
      className="bg-slate-900/80 backdrop-blur-md border-t border-white/10 p-4 outline-none"
    >
      <style>{`@keyframes optimism-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
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
        <BarSegment
          testId="bull-bar"
          pct={bullPct}
          colorClass="bg-emerald-500"
          delay={0}
          shouldReduceMotion={shouldReduceMotion}
          isOptimistic={optimisticSegment === "bull"}
          optimisticStatus={optimisticStatus}
        />
        {otherPct > 0 && (
          <BarSegment
            testId="other-bar"
            pct={otherPct}
            colorClass="bg-slate-500"
            delay={staggerDelay}
            shouldReduceMotion={shouldReduceMotion}
            isOptimistic={false}
            optimisticStatus={optimisticStatus}
          />
        )}
        <BarSegment
          testId="bear-bar"
          pct={bearPct}
          colorClass="bg-rose-500"
          delay={staggerDelay}
          shouldReduceMotion={shouldReduceMotion}
          isOptimistic={optimisticSegment === "bear"}
          optimisticStatus={optimisticStatus}
        />
      </div>
      <AnimatePresence>
        {showBadge && (
          <FirstVoterBadge shouldReduceMotion={shouldReduceMotion} />
        )}
      </AnimatePresence>
    </div>
  );
}
