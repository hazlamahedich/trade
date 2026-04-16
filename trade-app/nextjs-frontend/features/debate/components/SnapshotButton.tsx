"use client";

import { useCallback, useEffect, useRef } from "react";
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
  onResetError?: () => void;
}

const ERROR_RESET_MS = 3_000;
const TOOLTIP_LABEL = "Save debate as shareable image";

export function SnapshotButton({ onClick, state, onResetError }: SnapshotButtonProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    if (state === "generating") return;
    onClick().catch(() => {
      toast.error("Could not generate snapshot. Please try again.");
    });
  }, [onClick, state]);

  useEffect(() => {
    if (state === "error") {
      errorTimerRef.current = setTimeout(() => {
        errorTimerRef.current = null;
        onResetError?.();
      }, ERROR_RESET_MS);
    }
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [state, onResetError]);

  const isGenerating = state === "generating";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          data-testid="snapshot-button"
          onClick={handleClick}
          disabled={isGenerating}
          aria-label={TOOLTIP_LABEL}
          aria-busy={isGenerating}
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
        </button>
      </TooltipTrigger>
      <TooltipContent>{TOOLTIP_LABEL}</TooltipContent>
      <span className="sr-only" aria-live="polite">
        {isGenerating ? "Generating snapshot…" : state === "error" ? "Snapshot failed" : ""}
      </span>
    </Tooltip>
  );
}
