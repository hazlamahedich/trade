"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion, useReducedMotion } from "framer-motion";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskCheckNodeData } from "./types";

function RiskCheckNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as RiskCheckNodeData;
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
      className={cn(
        "px-3 py-2 rounded-lg border-2 min-w-[140px] max-w-[200px]",
        "border-violet-500/50 bg-violet-950/50 text-violet-100",
        "shadow-md opacity-60",
        nodeData.status !== "pending" && "opacity-100",
        nodeData.isWinning && "ring-2 ring-violet-500 shadow-violet-500/20 shadow-lg"
      )}
      role="group"
      aria-label={`Risk Check: ${nodeData.label} (${nodeData.status})`}
    >
      <Handle type="target" position={Position.Top} className="!bg-violet-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-violet-400" aria-hidden="true" />
        <span className="text-xs font-semibold truncate">{nodeData.label}</span>
      </div>
      <p className="text-[10px] text-violet-300 mt-1 truncate">
        {nodeData.status === "pending" ? "Awaiting Guardian..." : nodeData.summary}
      </p>
    </motion.div>
  );
}

export const RiskCheckNode = memo(RiskCheckNodeComponent);
