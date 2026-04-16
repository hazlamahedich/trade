"use client";

import {
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";

import { DataInputNode } from "./DataInputNode";
import { AgentAnalysisNode } from "./AgentAnalysisNode";
import { RiskCheckNode } from "./RiskCheckNode";
import { WinningPathEdge } from "./WinningPathEdge";

const nodeTypes = {
  dataInput: DataInputNode,
  agentAnalysis: AgentAnalysisNode,
  riskCheck: RiskCheckNode,
} as const;

const edgeTypes = {
  winningPath: WinningPathEdge,
} as const;

interface ReasoningGraphInnerProps {
  nodes: Parameters<typeof ReactFlow>[0]["nodes"];
  edges: Parameters<typeof ReactFlow>[0]["edges"];
  onNodesChange: Parameters<typeof ReactFlow>[0]["onNodesChange"];
  onEdgesChange: Parameters<typeof ReactFlow>[0]["onEdgesChange"];
}

function ReasoningGraphInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
}: ReasoningGraphInnerProps) {
  return (
    <div
      className="h-[250px] md:h-[350px] w-full rounded-lg border border-glass bg-slate-900/50"
      data-testid="reasoning-graph-container"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        panOnScroll={true}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesFocusable={true}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  );
}

export { ReasoningGraphInner };
export default ReasoningGraphInner;
