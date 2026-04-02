"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  useDebateSocket,
  type TokenPayload,
  type ArgumentPayload,
  type DataStalePayload,
  type ReasoningNodePayload,
  type GuardianInterruptPayload,
  type DebatePausedPayload,
} from "../hooks/useDebateSocket";
import { useReasoningGraph } from "../hooks/useReasoningGraph";
import { ArgumentBubble, type AgentType } from "./ArgumentBubble";
import { TypingIndicator } from "./TypingIndicator";
import { StaleDataWarning } from "./StaleDataWarning";
import { cn } from "@/lib/utils";

const ReasoningGraph = dynamic(
  () => import("./graph/ReasoningGraphWrapper").then((mod) => mod.ReasoningGraph),
  { ssr: false }
);

interface ArgumentMessage {
  id: string;
  type: "argument";
  agent: AgentType;
  content: string;
  timestamp: string;
}

interface GuardianMsg {
  id: string;
  type: "guardian";
  content: string;
  riskLevel: string;
  summaryVerdict: string;
  timestamp: string;
}

type DebateMessage = ArgumentMessage | GuardianMsg;

interface DebateStreamProps {
  debateId: string;
  className?: string;
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function DebateStream({ debateId, className }: DebateStreamProps) {
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentType | null>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [isDataStale, setIsDataStale] = useState(false);
  const [stalePayload, setStalePayload] = useState<{
    lastUpdate: string | null;
    ageSeconds: number;
  } | null>(null);
  const [reasoningNodes, setReasoningNodes] = useState<ReasoningNodePayload[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [lastGuardianRiskLevel, setLastGuardianRiskLevel] = useState<string | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const latestGuardianIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === "guardian") return i;
    }
    return -1;
  }, [messages]);

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (messages[index]?.type === "guardian" ? 120 : 100),
    overscan: 5,
  });

  const handleTokenReceived = useCallback((payload: TokenPayload) => {
    setIsStreaming(true);
    setCurrentAgent(payload.agent);
    setStreamingText((prev) => prev + payload.token);
  }, []);

  const handleArgumentComplete = useCallback((payload: ArgumentPayload) => {
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        type: "argument" as const,
        agent: payload.agent,
        content: payload.content,
        timestamp: new Date().toISOString(),
      },
    ]);
    setStreamingText("");
    setIsStreaming(false);
    setCurrentAgent(null);
    setUserScrolled(false);
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
  }, []);

  const handleDebatePaused = useCallback((payload: DebatePausedPayload) => {
    setIsPaused(true);
    setLastGuardianRiskLevel(payload.riskLevel);
  }, []);

  const handleDebateResumed = useCallback(() => {
    setIsPaused(false);
    setLastGuardianRiskLevel(null);
  }, []);

  const handleAcknowledge = useCallback(() => {
    setIsDataStale(false);
  }, []);

  const { status, sendGuardianAck } = useDebateSocket({
    debateId,
    onTokenReceived: handleTokenReceived,
    onArgumentComplete: handleArgumentComplete,
    onDataStale: handleDataStale,
    onDataRefreshed: handleDataRefreshed,
    onReasoningNode: handleReasoningNode,
    onGuardianInterrupt: handleGuardianInterrupt,
    onDebatePaused: handleDebatePaused,
    onDebateResumed: handleDebateResumed,
  });

  const { nodes: graphNodes, edges: graphEdges, onNodesChange, onEdgesChange } = useReasoningGraph(reasoningNodes);

  useEffect(() => {
    if (parentRef.current && !userScrolled && messages.length > 0) {
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [messages.length, streamingText, userScrolled]);

  const handleScroll = useCallback(() => {
    if (!parentRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    setUserScrolled(!isAtBottom);
  }, []);

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <>
      {isDataStale && stalePayload && (
        <StaleDataWarning
          lastUpdate={stalePayload.lastUpdate}
          ageSeconds={stalePayload.ageSeconds}
          onAcknowledge={handleAcknowledge}
        />
      )}
      <div
        ref={parentRef}
        data-testid="debate-stream"
        data-empty={isEmpty}
        role="log"
        aria-live="polite"
        aria-label="Debate messages"
        onScroll={handleScroll}
        className={cn(
          "flex flex-col gap-4 h-full overflow-y-auto p-4",
          "bg-slate-900 rounded-lg",
          isDataStale && "grayscale",
          isPaused && "ring-2 ring-violet-600",
          className
        )}
      >
        {isEmpty && (
          <div
            data-testid="debate-stream-empty"
            className="flex-1 flex items-center justify-center text-slate-400"
          >
            <p>Waiting for debate to start...</p>
          </div>
        )}

        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const message = messages[virtualRow.index];
            return (
              <div
                key={message.id}
                data-testid={
                  message.type === "guardian"
                    ? `guardian-message-${message.id}`
                    : `argument-${message.id}`
                }
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {message.type === "guardian" ? (
                  <div className="flex justify-center">
                    <div className="bg-violet-600/20 border border-violet-600 rounded-lg p-3 max-w-[80%] text-center">
                      <div className="flex items-center justify-center gap-2 text-violet-400 text-xs font-semibold mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 1l-9 4.5v9L10 19l9-4.5v-9L10 1zm0 2.18l6 3v6.64l-6 3-6-3V6.18l6-3z" clipRule="evenodd" />
                        </svg>
                        <span>GUARDIAN: {message.summaryVerdict}</span>
                      </div>
                      <p className="text-violet-200 text-sm">{message.content}</p>
                      {isPaused && virtualRow.index === latestGuardianIdx && lastGuardianRiskLevel !== "critical" && (
                        <button
                          data-testid={`ack-guardian-${message.id}`}
                          onClick={sendGuardianAck}
                          className="mt-2 px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          Acknowledge &amp; Resume
                        </button>
                      )}
                      {isPaused && virtualRow.index === latestGuardianIdx && lastGuardianRiskLevel === "critical" && (
                        <div className="mt-2 text-red-400 text-sm font-semibold">
                          Critical risk detected. Debate ended.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <ArgumentBubble
                    agent={message.agent}
                    content={message.content}
                    timestamp={message.timestamp}
                  />
                )}
              </div>
            );
          })}
        </div>

        {isPaused && (
          <div
            data-testid="debate-paused-indicator"
            className="flex items-center justify-center gap-2 text-violet-400 text-sm"
          >
            <span className="animate-pulse">⏸</span>
            <span>Debate paused — awaiting your acknowledgment</span>
          </div>
        )}

        <AnimatePresence>
          {isStreaming && currentAgent && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={
                shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }
              }
            >
              {streamingText ? (
                <ArgumentBubble
                  agent={currentAgent}
                  content={streamingText}
                  timestamp={new Date().toISOString()}
                  isStreaming
                />
              ) : (
                <TypingIndicator agent={currentAgent} isVisible />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {reasoningNodes.length > 0 && (
          <div className="mt-4">
            <ReasoningGraph
              nodes={graphNodes}
              edges={graphEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
            />
          </div>
        )}

        <div
          data-testid="ws-connection-status"
          data-status={status}
          className="fixed bottom-4 right-4"
        >
          {status !== "connected" && (
            <span className="text-xs text-slate-500">
              {status === "connecting" ? "Reconnecting..." : "Disconnected"}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
