"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion, motion } from "framer-motion";
import { Camera, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { SnapshotState } from "../types/snapshot";

interface SnapshotButtonProps {
  onClick: () => Promise<void>;
  state: SnapshotState;
  onResetState?: () => void;
  successAnnouncement?: string;
}

const ERROR_RESET_MS = 3_000;
const TOOLTIP_LABEL = "Capture this debate";
const ENTRANCE_DELAY_MS = 600;

export function SnapshotButton({ onClick, state, onResetState, successAnnouncement }: SnapshotButtonProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasAppeared, setHasAppeared] = useState(false);
  const [showEntranceTip, setShowEntranceTip] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHasAppeared(true), ENTRANCE_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (hasAppeared && !showEntranceTip) {
      const tipKey = "snapshot-tip-shown";
      try {
        if (!sessionStorage.getItem(tipKey)) {
          setShowEntranceTip(true);
          sessionStorage.setItem(tipKey, "1");
          const t = setTimeout(() => setShowEntranceTip(false), 3_000);
          return () => clearTimeout(t);
        }
      } catch {
        // sessionStorage unavailable (SSR or privacy mode)
      }
    }
  }, [hasAppeared]);

  useEffect(() => {
    if (state === "error") {
      errorTimerRef.current = setTimeout(() => {
        errorTimerRef.current = null;
        onResetState?.();
      }, ERROR_RESET_MS);
    }
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [state, onResetState]);

  const handleClick = useCallback(() => {
    if (state === "generating") return;
    onClick().catch(() => {
      toast.error("Could not generate snapshot. Please try again.");
    });
  }, [onClick, state]);

  const isGenerating = state === "generating";

  const ariaStatus = isGenerating
    ? "Generating snapshot…"
    : state === "error"
      ? "Snapshot failed"
      : state === "success" && successAnnouncement
        ? successAnnouncement
        : "";

  if (!hasAppeared) return null;

  return (
    <Tooltip open={showEntranceTip || undefined}>
      <TooltipTrigger asChild>
        <motion.button
          data-testid="snapshot-button"
          onClick={handleClick}
          disabled={isGenerating}
          aria-label={TOOLTIP_LABEL}
          aria-busy={isGenerating}
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
          className={
            "min-h-[44px] min-w-[44px] flex items-center justify-center " +
            "rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 " +
            "text-slate-400 hover:text-slate-200 transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 " +
            "disabled:opacity-50 disabled:cursor-not-allowed"
          }
        >
          {isGenerating ? (
            <motion.div
              animate={shouldReduceMotion ? { rotate: 0 } : { rotate: 360 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { repeat: Infinity, duration: 1, ease: "linear" }
              }
            >
              <Loader2 className="w-5 h-5" />
            </motion.div>
          ) : (
            <Camera className="w-5 h-5" />
          )}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>{TOOLTIP_LABEL}</TooltipContent>
      <span className="sr-only" aria-live="polite">
        {ariaStatus}
      </span>
    </Tooltip>
  );
}
