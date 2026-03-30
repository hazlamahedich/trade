import type { Node, Edge } from "@xyflow/react";

export type DataInputNodeData = {
  label: string;
  summary: string;
  asset: string;
  isWinning: boolean;
};

export type AgentAnalysisNodeData = {
  label: string;
  summary: string;
  agent: "bull" | "bear";
  turn: number;
  isWinning: boolean;
};

export type RiskCheckNodeData = {
  label: string;
  summary: string;
  status: "pending" | "safe" | "warning";
  isWinning: boolean;
};

export type DataInputNode = Node<DataInputNodeData, "dataInput">;
export type AgentAnalysisNode = Node<AgentAnalysisNodeData, "agentAnalysis">;
export type RiskCheckNode = Node<RiskCheckNodeData, "riskCheck">;

export type ReasoningNode = DataInputNode | AgentAnalysisNode | RiskCheckNode;

export type WinningPathEdge = Edge<
  {
    isWinningPath: boolean;
    agent?: "bull" | "bear";
  },
  "winningPath"
>;

export type ReasoningEdge = WinningPathEdge;

export const NODE_VERTICAL_SPACING = 120;
export const NODE_HORIZONTAL_OFFSET = 0;
