"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion, useReducedMotion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AgentAvatar } from "../AgentAvatar";
import { cn } from "@/lib/utils";
import type { AgentAnalysisNodeData } from "./types";

function AgentAnalysisNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as AgentAnalysisNodeData;
  const shouldReduceMotion = useReducedMotion();
  const isBull = nodeData.agent === "bull";

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
      className={cn(
        "px-3 py-2 rounded-lg border-2 min-w-[140px] max-w-[200px]",
        "shadow-md",
        isBull
          ? "border-emerald-500/50 bg-emerald-950/50 text-emerald-100"
          : "border-rose-500/50 bg-rose-950/50 text-rose-100",
        nodeData.isWinning &&
          (isBull
            ? "ring-2 ring-emerald-500 shadow-emerald-500/20 shadow-lg"
            : "ring-2 ring-rose-500 shadow-rose-500/20 shadow-lg")
      )}
      role="group"
      aria-label={`${isBull ? "Bull" : "Bear"} Analysis: ${nodeData.label}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        {nodeData.agent && <AgentAvatar agent={nodeData.agent} size="sm" />}
        <span className="text-xs font-semibold truncate">{nodeData.label}</span>
      </div>
      {nodeData.summary && (
        <p
          className={cn(
            "text-[10px] mt-1 truncate",
            isBull ? "text-emerald-300" : "text-rose-300"
          )}
        >
          {nodeData.summary}
        </p>
      )}
    </motion.div>
  );
}

export const AgentAnalysisNode = memo(AgentAnalysisNodeComponent);
