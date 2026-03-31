"use client";

import { useEffect, useRef } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import type {
  ReasoningNode,
  ReasoningEdge,
  DataInputNodeData,
  AgentAnalysisNodeData,
  RiskCheckNodeData,
} from "../components/graph/types";
import { NODE_VERTICAL_SPACING } from "../components/graph/types";

export type { ReasoningNodeType } from "./useDebateSocket";
export type { ReasoningNodePayload as ReasoningNodePayload } from "./useDebateSocket";
import type { ReasoningNodePayload } from "./useDebateSocket";

function payloadToNode(payload: ReasoningNodePayload, index: number): ReasoningNode {
  const position = { x: 0, y: index * NODE_VERTICAL_SPACING };

  if (payload.nodeType === "data_input") {
    return {
      id: payload.nodeId,
      type: "dataInput",
      position,
      data: {
        label: payload.label,
        summary: payload.summary,
        asset: payload.label.split(" ")[0] || "",
        isWinning: payload.isWinning,
      } satisfies DataInputNodeData,
    };
  }

  if (
    payload.nodeType === "bull_analysis" ||
    payload.nodeType === "bear_counter"
  ) {
    return {
      id: payload.nodeId,
      type: "agentAnalysis",
      position,
      data: {
        label: payload.label,
        summary: payload.summary,
        agent: (payload.agent || "bull") as "bull" | "bear",
        turn: payload.turn || 0,
        isWinning: payload.isWinning,
      } satisfies AgentAnalysisNodeData,
    };
  }

  if (payload.nodeType === "risk_check") {
    return {
      id: payload.nodeId,
      type: "riskCheck",
      position,
      data: {
        label: payload.label,
        summary: payload.summary,
        status: "pending" as const,
        isWinning: payload.isWinning,
      } satisfies RiskCheckNodeData,
    };
  }

  throw new Error(`Unknown node type: ${payload.nodeType}`);
}

function createEdge(
  parentId: string,
  childId: string,
  agent: "bull" | "bear" | null
): ReasoningEdge {
  return {
    id: `edge-${parentId}-${childId}`,
    source: parentId,
    target: childId,
    type: "winningPath",
    data: {
      isWinningPath: false,
      agent: agent ?? undefined,
    },
  };
}

export function useReasoningGraph(reasoningNodes: ReasoningNodePayload[]) {
  const processedIds = useRef<Set<string>>(new Set());
  const nodesRef = useRef(reasoningNodes);
  nodesRef.current = reasoningNodes;
  const [nodes, setNodes, onNodesChange] = useNodesState<ReasoningNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ReasoningEdge>([]);

  useEffect(() => {
    for (const payload of nodesRef.current) {
      if (processedIds.current.has(payload.nodeId) && !payload.isWinning) {
        continue;
      }
      processedIds.current.add(payload.nodeId);

      if (payload.isWinning) {
        const targetId = payload.nodeId;
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== targetId) return n;
            const updatedData = { ...n.data, isWinning: true };
            if (n.type === "dataInput") {
              return { ...n, data: updatedData as DataInputNodeData };
            }
            if (n.type === "agentAnalysis") {
              return { ...n, data: updatedData as AgentAnalysisNodeData };
            }
            if (n.type === "riskCheck") {
              return { ...n, data: updatedData as RiskCheckNodeData };
            }
            return n;
          })
        );
        setEdges((eds) =>
          eds.map((e) =>
            e.source === payload.nodeId || e.target === payload.nodeId
              ? {
                  ...e,
                  data: { ...e.data, isWinningPath: true },
                }
              : e
          )
        );
      } else {
        setNodes((nds) => {
          const newNode = payloadToNode(payload, nds.length);
          return [...nds, newNode];
        });

        if (payload.parentId) {
          const newEdge = createEdge(
            payload.parentId,
            payload.nodeId,
            payload.agent
          );
          setEdges((eds) => [...eds, newEdge]);
        }
      }
    }
  }, [reasoningNodes.length, setNodes, setEdges]);

  return { nodes, edges, onNodesChange, onEdgesChange };
}
