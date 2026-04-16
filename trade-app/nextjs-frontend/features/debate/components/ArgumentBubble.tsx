"use client";

import { motion } from "framer-motion";
import { AgentAvatar, type AgentType } from "./AgentAvatar";
export type { AgentType };
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface ArgumentBubbleProps {
  agent: AgentType;
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  isRedacted?: boolean;
}

const messageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const REDACTED_RE = /\[REDACTED\]/g;

function renderContent(content: string, isRedacted: boolean) {
  if (!isRedacted) return content;

  const parts = content.split(REDACTED_RE);
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && (
        <span
          role="presentation"
          aria-label="filtered phrase removed for safety compliance"
          className="bg-purple-500/20 text-purple-300 px-1 py-0.5 rounded text-sm border border-purple-500/30"
        >
          [REDACTED]
        </span>
      )}
    </span>
  ));
}

export function ArgumentBubble({ agent, content, timestamp, isStreaming, isRedacted }: ArgumentBubbleProps) {
  const isBull = agent === "bull";
  // Two independent signals for redaction:
  // - hasRedactedContent: string-based detection for inline [REDACTED] span rendering.
  //   Handles the visual content layer — if [REDACTED] tokens exist, render them as purple spans.
  // - showBadge: prop-driven from backend isRedacted flag for the Safety Filtered badge.
  //   Handles the metadata layer — backend signals the message was filtered.
  // These CAN disagree: backend may set isRedacted=false while content contains [REDACTED] tokens
  // (or vice versa). This is intentional — the badge is a backend trust signal, the spans are a
  // content rendering concern. Disagreement indicates a backend data inconsistency, not a UI bug.
  // See: Story 2.5 Dev Notes, "Separation of Concerns: Badge vs. Inline Redaction".
  const hasRedactedContent = content.includes("[REDACTED]");
  const showBadge = isRedacted === true;

  return (
    <motion.div
      data-testid="argument-bubble"
      data-agent={agent}
      role="article"
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "flex gap-3 p-4 rounded-lg border",
        isBull
          ? "flex-row bg-emerald-500/10 border-emerald-500/20"
          : "flex-row-reverse bg-rose-500/10 border-rose-500/20"
      )}
    >
      <AgentAvatar agent={agent} />
      <div className="flex-1 min-w-0">
        <div
          data-testid="argument-header"
          className={cn(
            "flex items-center gap-2 mb-1",
            isBull ? "flex-row" : "flex-row-reverse"
          )}
        >
          <span
            className={cn(
              "font-semibold text-sm",
              isBull ? "text-emerald-500" : "text-rose-500"
            )}
          >
            {isBull ? "Bull" : "Bear"}
          </span>
          <span
            data-testid="argument-timestamp"
            className="text-xs text-secondary-safe"
          >
            {formatTime(timestamp)}
          </span>
        </div>
        <div
          data-testid="argument-content"
          role={hasRedactedContent ? "text" : undefined}
          aria-label={hasRedactedContent ? "Debate argument containing filtered phrases for safety compliance" : undefined}
          className="text-slate-200 text-base leading-relaxed break-words"
        >
          {renderContent(content, hasRedactedContent)}
          {isStreaming && (
            <span
              data-testid="streaming-cursor"
              className="inline-block w-2 h-4 ml-1 bg-emerald-500 animate-pulse"
            />
          )}
        </div>

        {showBadge && (
          <div className="mt-1.5">
            <div className="hidden sm:block">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    data-testid="safety-filtered-badge"
                    tabIndex={0}
                    aria-label="This message was filtered by the safety system"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-violet-600/20 text-violet-400 rounded-md cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
                  >
                    <Shield className="w-3 h-3" aria-hidden="true" />
                    Safety Filtered
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This content was filtered to keep the discussion respectful.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="sm:hidden flex items-start gap-1.5 text-xs text-violet-400/80" data-testid="safety-filtered-mobile" aria-label="This message was filtered by the safety system">
              <Shield className="w-3 h-3 shrink-0 mt-px" aria-hidden="true" />
              <span>Safety Filtered — This content was filtered to keep the discussion respectful.</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
