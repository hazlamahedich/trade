"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentType = "bull" | "bear";

interface AgentAvatarProps {
  agent: AgentType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
};

const iconSizeClasses = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

export function AgentAvatar({ agent, size = "md", className }: AgentAvatarProps) {
  const isBull = agent === "bull";

  return (
    <div
      data-testid={`${agent}-icon`}
      className={cn(
        "rounded-full flex items-center justify-center",
        sizeClasses[size],
        isBull ? "bg-emerald-500/20" : "bg-rose-500/20",
        className
      )}
      aria-label={isBull ? "Bull - Trending Up" : "Bear - Trending Down"}
    >
      {isBull ? (
        <TrendingUp className={cn(iconSizeClasses[size], "text-emerald-500")} />
      ) : (
        <TrendingDown className={cn(iconSizeClasses[size], "text-rose-500")} />
      )}
    </div>
  );
}
