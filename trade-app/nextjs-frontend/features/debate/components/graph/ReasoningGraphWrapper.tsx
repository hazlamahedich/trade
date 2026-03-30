"use client";

import { ReactFlowProvider } from "@xyflow/react";
import type { OnNodesChange, OnEdgesChange } from "@xyflow/react";

import { ReasoningGraphInner } from "./ReasoningGraph";
import type { ReasoningNode, ReasoningEdge } from "./types";

export interface ReasoningGraphProps {
  nodes: ReasoningNode[];
  edges: ReasoningEdge[];
  onNodesChange: OnNodesChange<ReasoningNode>;
  onEdgesChange: OnEdgesChange<ReasoningEdge>;
}

export function ReasoningGraph({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
}: ReasoningGraphProps) {
  return (
    <ReactFlowProvider>
      <ReasoningGraphInner
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as never}
        onEdgesChange={onEdgesChange as never}
      />
    </ReactFlowProvider>
  );
}
