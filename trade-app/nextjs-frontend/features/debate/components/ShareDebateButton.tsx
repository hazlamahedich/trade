"use client";

import { useReducedMotion, motion } from "framer-motion";
import { Share2, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useShareDebate } from "../hooks/useShareDebate";

interface ShareDebateButtonProps {
  assetName: string;
  externalId: string;
  debateStatus?: "active" | "completed";
  disabled?: boolean;
  className?: string;
  source?: "debate_detail" | "debate_stream";
}

const TOOLTIP_LABEL = "Share debate";

export function ShareDebateButton({
  assetName,
  externalId,
  debateStatus,
  disabled,
  className,
  source,
}: ShareDebateButtonProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const { share, isSharing } = useShareDebate({ assetName, externalId, debateStatus, source });

  const isDisabled = isSharing || disabled;

  const ariaStatus = isSharing
    ? "Sharing debate…"
    : "";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          data-testid="share-debate-button"
          onClick={share}
          disabled={isDisabled}
          aria-label={TOOLTIP_LABEL}
          aria-busy={isSharing}
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
          className={
            "min-h-[44px] min-w-[44px] flex items-center justify-center " +
            "rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 " +
            "text-slate-400 hover:text-slate-200 transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 " +
            "disabled:opacity-50 disabled:cursor-not-allowed" +
            (className ? ` ${className}` : "")
          }
        >
          {isSharing ? (
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
            <Share2 className="w-5 h-5" />
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
