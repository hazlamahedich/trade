"use client";

import { AgentAvatar, type AgentType } from "./AgentAvatar";
import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  agent: AgentType | null;
  isVisible: boolean;
  message?: string;
}

export function TypingIndicator({ agent, isVisible, message }: TypingIndicatorProps) {
  if (!isVisible) {
    return null;
  }

  const isBull = agent === "bull";
  const defaultMessage = isBull ? "Bull is thinking..." : "Bear is analyzing...";
  const displayMessage = message || defaultMessage;

  return (
    <div
      data-testid="typing-indicator"
      aria-live="polite"
      aria-label={agent ? `${agent} is thinking` : "Agent is typing"}
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg",
        isBull ? "flex-row bg-emerald-500/5" : "flex-row-reverse bg-rose-500/5"
      )}
    >
      {agent && <AgentAvatar agent={agent} size="sm" />}
      <div className="flex items-center gap-2">
        <div
          data-testid="typing-dots"
          className="flex gap-1 motion-safe:animate-pulse"
        >
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="w-2 h-2 rounded-full bg-slate-400" />
        </div>
        <span className="text-sm text-slate-400">
          {displayMessage}
        </span>
      </div>
    </div>
  );
}
