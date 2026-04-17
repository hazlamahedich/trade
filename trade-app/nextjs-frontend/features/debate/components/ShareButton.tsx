"use client";

import { useCallback, useEffect, useState } from "react";
import { useReducedMotion, motion } from "framer-motion";
import { Share, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { QuoteShareState } from "../types/quote-share";

interface ShareButtonProps {
  shareState: QuoteShareState;
  onShare: () => void;
  isStreaming?: boolean;
  isRedacted?: boolean;
  showHint?: boolean;
  onDismissHint?: () => void;
}

const TOOLTIP_LABEL = "Share this argument";

export function ShareButton({
  shareState,
  onShare,
  isStreaming,
  isRedacted,
  showHint,
  onDismissHint,
}: ShareButtonProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const isGenerating = shareState === "generating";
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    if (!showHint || hintVisible) return;
    let dismissTimer: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      setHintVisible(true);
      dismissTimer = setTimeout(() => {
        setHintVisible(false);
        onDismissHint?.();
      }, 3000);
    }, 500);
    return () => { clearTimeout(timer); clearTimeout(dismissTimer); };
  }, [showHint, hintVisible, onDismissHint]);

  const handleClick = useCallback(() => {
    if (isGenerating) return;
    onShare();
  }, [onShare, isGenerating]);

  if (isStreaming || isRedacted) return null;

  const ariaStatus = isGenerating
    ? "Generating quote card…"
    : shareState === "error"
      ? "Quote card generation failed"
      : shareState === "success"
        ? "Quote card shared"
        : "";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          data-testid="share-button"
          onClick={handleClick}
          disabled={isGenerating}
          aria-label={TOOLTIP_LABEL}
          aria-busy={isGenerating}
          tabIndex={-1}
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
          className={
            "min-h-[44px] min-w-[44px] flex items-center justify-center " +
            "rounded-md bg-white/5 hover:bg-white/10 border border-white/15 " +
            "text-slate-400 hover:text-slate-200 transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 " +
            "disabled:opacity-50 disabled:cursor-not-allowed" +
            (isGenerating ? " pointer-events-none" : "") +
            (hintVisible ? " ring-2 ring-white/40 animate-pulse" : "")
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
              <Loader2 className="w-4 h-4" />
            </motion.div>
          ) : (
            <Share className="w-4 h-4" />
          )}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>{hintVisible ? "Hover any argument to share it" : TOOLTIP_LABEL}</TooltipContent>
      <span className="sr-only" aria-live="polite">
        {ariaStatus}
      </span>
    </Tooltip>
  );
}
