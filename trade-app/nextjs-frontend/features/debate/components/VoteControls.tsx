"use client";

import { useReducedMotion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VoteChoice, VoteStatus } from "../hooks/useVote";

interface VoteControlsProps {
  vote: (choice: VoteChoice) => void;
  userVote: VoteChoice | null;
  voteStatus: VoteStatus;
  disabled?: boolean;
  isFrozen?: boolean;
}

export function VoteControls({
  vote,
  userVote,
  voteStatus,
  disabled = false,
  isFrozen = false,
}: VoteControlsProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const isVoting = voteStatus === "voting";
  const bothDisabled = isVoting || disabled || isFrozen;

  const bullLabel =
    userVote === "bull"
      ? "You voted Bull Won — cannot be changed"
      : "Vote Bull Won";
  const bearLabel =
    userVote === "bear"
      ? "You voted Bear Won — cannot be changed"
      : "Vote Bear Won";

  return (
    <div
      aria-live="polite"
      role="region"
      aria-label="Vote on debate outcome"
      className="sticky bottom-0 bg-slate-900/80 backdrop-blur-md border-t border-white/10 p-4"
    >
      {isFrozen && (
        <p className="text-center text-xs text-slate-300 mb-2" role="status">
          Voting paused during risk review
        </p>
      )}
      <div className="flex gap-3">
        <Button
          data-testid="vote-bull-btn"
          aria-label={bullLabel}
          aria-disabled={bothDisabled || userVote === "bear"}
          disabled={bothDisabled || userVote === "bear"}
          onClick={() => vote("bull")}
          className={cn(
            "flex-1 min-h-[44px] text-white",
            shouldReduceMotion ? "" : "transition-colors",
            userVote === "bull"
              ? "bg-emerald-500 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900"
              : bothDisabled
                ? "bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
                : "bg-emerald-500 hover:bg-emerald-600",
            !shouldReduceMotion && isVoting && userVote === "bull" && "animate-pulse",
          )}
        >
          <TrendingUp className="mr-2 h-4 w-4" aria-hidden="true" />
          {isVoting && userVote === "bull" ? "Voting…" : "Bull Won"}
        </Button>
        <Button
          data-testid="vote-bear-btn"
          aria-label={bearLabel}
          aria-disabled={bothDisabled || userVote === "bull"}
          disabled={bothDisabled || userVote === "bull"}
          onClick={() => vote("bear")}
          className={cn(
            "flex-1 min-h-[44px] text-white",
            shouldReduceMotion ? "" : "transition-colors",
            userVote === "bear"
              ? "bg-rose-500 text-white ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-900"
              : bothDisabled
                ? "bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
                : "bg-rose-500 hover:bg-rose-600",
            !shouldReduceMotion && isVoting && userVote === "bear" && "animate-pulse",
          )}
        >
          <TrendingDown className="mr-2 h-4 w-4" aria-hidden="true" />
          {isVoting && userVote === "bear" ? "Voting…" : "Bear Won"}
        </Button>
      </div>
    </div>
  );
}
