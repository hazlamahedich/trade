"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion, useReducedMotion } from "framer-motion";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataInputNodeData } from "./types";

function DataInputNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as DataInputNodeData;
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
      className={cn(
        "px-3 py-2 rounded-lg border-2 min-w-[140px] max-w-[200px]",
        "border-slate-400 bg-slate-800 text-slate-200",
        "shadow-md",
        nodeData.isWinning && "ring-2 ring-slate-400 shadow-slate-400/20 shadow-lg"
      )}
      role="group"
      aria-label={`Data Input: ${nodeData.label}`}
    >
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-slate-400" aria-hidden="true" />
        <span className="text-xs font-semibold truncate">{nodeData.label}</span>
      </div>
      {nodeData.summary && (
        <p className="text-[10px] text-slate-400 mt-1 truncate">{nodeData.summary}</p>
      )}
    </motion.div>
  );
}

export const DataInputNode = memo(DataInputNodeComponent);
