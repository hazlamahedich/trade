import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDebateSocket,
  type TokenPayload,
  type ArgumentPayload,
  type DataStalePayload,
  type ReasoningNodePayload,
  type GuardianInterruptPayload,
  type VoteUpdatePayload,
} from "./useDebateSocket";
import { useReasoningGraph } from "./useReasoningGraph";
import { useGuardianFreeze } from "./useGuardianFreeze";
import { queryKeys } from "./queryKeys";
import type { DebateResultEnvelope } from "../api";
import type { AgentType } from "../components/ArgumentBubble";
import type { OptimisticSegment, OptimisticStatus } from "../components/SentimentReveal";

export interface ArgumentMessage {
  id: string;
  type: "argument";
  agent: AgentType;
  content: string;
  timestamp: string;
  isRedacted?: boolean;
}

interface GuardianMsg {
  id: string;
  type: "guardian";
  content: string;
  riskLevel: string;
  summaryVerdict: string;
  timestamp: string;
}

export type DebateMessage = ArgumentMessage | GuardianMsg;

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface UseDebateMessagesReturn {
  messages: DebateMessage[];
  streamingText: string;
  isStreaming: boolean;
  currentAgent: AgentType | null;
  isDataStale: boolean;
  stalePayload: { lastUpdate: string | null; ageSeconds: number } | null;
  debateStatus: "running" | "completed" | "paused" | "cancelled";
  reasoningNodes: ReasoningNodePayload[];
  wsStatus: ReturnType<typeof useDebateSocket>["status"];
  freezeState: ReturnType<typeof useGuardianFreeze>["state"];
  isFrozen: boolean;
  acknowledgeFreeze: ReturnType<typeof useGuardianFreeze>["acknowledgeFreeze"];
  ignoreFreeze: ReturnType<typeof useGuardianFreeze>["ignoreFreeze"];
  retryAck: ReturnType<typeof useGuardianFreeze>["retryAck"];
  clearFreeze: ReturnType<typeof useGuardianFreeze>["clearFreeze"];
  graphNodes: ReturnType<typeof useReasoningGraph>["nodes"];
  graphEdges: ReturnType<typeof useReasoningGraph>["edges"];
  onNodesChange: ReturnType<typeof useReasoningGraph>["onNodesChange"];
  onEdgesChange: ReturnType<typeof useReasoningGraph>["onEdgesChange"];
  acknowledgeStale: () => void;
  lastArgumentRef: React.MutableRefObject<ArgumentMessage | null>;
}

export function useDebateMessages(debateId: string, shouldReduceMotion = false): UseDebateMessagesReturn {
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentType | null>(null);
  const [isDataStale, setIsDataStale] = useState(false);
  const [stalePayload, setStalePayload] = useState<{
    lastUpdate: string | null;
    ageSeconds: number;
  } | null>(null);
  const [reasoningNodes, setReasoningNodes] = useState<ReasoningNodePayload[]>([]);
  const [debateStatus, setDebateStatus] = useState<"running" | "completed" | "paused" | "cancelled">("running");

  const lastArgumentRef = useRef<ArgumentMessage | null>(null);
  const triggerFreezeRef = useRef<(payload: GuardianInterruptPayload, triggerArg: ArgumentMessage | null) => void>(() => {});
  const freezeHandleResumedRef = useRef<() => void>(() => {});
  const vibrationActive = useRef(false);

  const handleTokenReceived = useCallback((payload: TokenPayload) => {
    setIsStreaming(true);
    setCurrentAgent(payload.agent);
    setStreamingText((prev) => prev + payload.token);
  }, []);

  const handleArgumentComplete = useCallback((payload: ArgumentPayload) => {
    const argMsg: ArgumentMessage = {
      id: generateId(),
      type: "argument",
      agent: payload.agent,
      content: payload.content,
      timestamp: new Date().toISOString(),
      isRedacted: payload.isRedacted === true,
    };
    lastArgumentRef.current = argMsg;
    setMessages((prev) => [...prev, argMsg]);
    setStreamingText("");
    setIsStreaming(false);
    setCurrentAgent(null);
  }, []);

  const handleDataStale = useCallback((payload: DataStalePayload) => {
    setIsDataStale(true);
    setStalePayload({
      lastUpdate: payload.lastUpdate,
      ageSeconds: payload.ageSeconds,
    });
  }, []);

  const handleDataRefreshed = useCallback(() => {
    setIsDataStale(false);
    setStalePayload(null);
  }, []);

  const handleReasoningNode = useCallback((payload: ReasoningNodePayload) => {
    setReasoningNodes((prev) => [...prev, payload]);
  }, []);

  const acknowledgeStale = useCallback(() => {
    setIsDataStale(false);
  }, []);

  const handleStatusUpdate = useCallback((payload: { status: string }) => {
    const valid: string[] = ["running", "completed", "paused", "cancelled"];
    if (valid.includes(payload.status)) {
      setDebateStatus(payload.status as "running" | "completed" | "paused" | "cancelled");
    }
  }, []);

  const queryClient = useQueryClient();

  const handleVoteUpdate = useCallback(
    (payload: VoteUpdatePayload) => {
      queryClient.setQueryData<DebateResultEnvelope>(
        queryKeys.debateResult(debateId),
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: {
              ...old.data,
              totalVotes: payload.totalVotes,
              voteBreakdown: payload.voteBreakdown,
            },
          };
        }
      );
    },
    [queryClient, debateId]
  );

  const handleGuardianInterrupt = useCallback((payload: GuardianInterruptPayload) => {
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        type: "guardian" as const,
        content: payload.reason,
        riskLevel: payload.riskLevel,
        summaryVerdict: payload.summaryVerdict,
        timestamp: new Date().toISOString(),
      },
    ]);
    triggerFreezeRef.current(payload, lastArgumentRef.current);
    if (payload.riskLevel === "critical" && !shouldReduceMotion) {
      try {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
          vibrationActive.current = true;
        }
      } catch {
        // vibration not supported
      }
    }
  }, [shouldReduceMotion]);

  useEffect(() => {
    return () => {
      if (vibrationActive.current) {
        try {
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([]);
          }
        } catch {
          // ignore
        }
        vibrationActive.current = false;
      }
    };
  }, []);

  const handleDebateResumed = useCallback(() => {
    freezeHandleResumedRef.current();
  }, []);

  const { status: wsStatus, sendGuardianAck } = useDebateSocket({
    debateId,
    onTokenReceived: handleTokenReceived,
    onArgumentComplete: handleArgumentComplete,
    onDataStale: handleDataStale,
    onDataRefreshed: handleDataRefreshed,
    onReasoningNode: handleReasoningNode,
    onGuardianInterrupt: handleGuardianInterrupt,
    onDebateResumed: handleDebateResumed,
    onStatusUpdate: handleStatusUpdate,
    onVoteUpdate: handleVoteUpdate,
  });

  const sendGuardianAckRef = useRef(sendGuardianAck);
  useEffect(() => {
    sendGuardianAckRef.current = sendGuardianAck;
  }, [sendGuardianAck]);

  const {
    state: freezeState,
    isFrozen,
    triggerFreeze,
    acknowledgeFreeze,
    ignoreFreeze,
    retryAck,
    clearFreeze,
    handleDebateResumed: freezeHandleResumed,
  } = useGuardianFreeze({
    sendGuardianAck: useCallback(() => sendGuardianAckRef.current(), []),
  });

  useEffect(() => {
    triggerFreezeRef.current = triggerFreeze;
  }, [triggerFreeze]);

  useEffect(() => {
    freezeHandleResumedRef.current = freezeHandleResumed;
  }, [freezeHandleResumed]);

  const { nodes: graphNodes, edges: graphEdges, onNodesChange, onEdgesChange } = useReasoningGraph(reasoningNodes);

  return {
    messages,
    streamingText,
    isStreaming,
    currentAgent,
    isDataStale,
    stalePayload,
    debateStatus,
    reasoningNodes,
    wsStatus,
    freezeState,
    isFrozen,
    acknowledgeFreeze,
    ignoreFreeze,
    retryAck,
    clearFreeze,
    graphNodes,
    graphEdges,
    onNodesChange,
    onEdgesChange,
    acknowledgeStale,
    lastArgumentRef,
  };
}
