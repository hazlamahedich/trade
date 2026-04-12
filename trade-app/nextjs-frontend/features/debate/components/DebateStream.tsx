"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
} from "../hooks/useDebateSocket";
import { useReasoningGraph } from "../hooks/useReasoningGraph";
import { useGuardianFreeze } from "../hooks/useGuardianFreeze";
import { useVote } from "../hooks/useVote";
import { useVotingStatus } from "../hooks/useVotingStatus";
import { ArgumentBubble, type AgentType } from "./ArgumentBubble";
import { TypingIndicator } from "./TypingIndicator";
import { StaleDataWarning } from "./StaleDataWarning";
import { GuardianOverlay } from "./GuardianOverlay";
import { VoteControls } from "./VoteControls";
import { SentimentReveal } from "./SentimentReveal";
import { cn } from "@/lib/utils";

const ReasoningGraph = dynamic(
  () => import("./graph/ReasoningGraphWrapper").then((mod) => mod.ReasoningGraph),
  { ssr: false }
);

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
  const [debateStatus, setDebateStatus] = useState<"running" | "completed" | "paused" | "cancelled">("running");

  const parentRef = useRef<HTMLDivElement>(null);
  const lastArgumentRef = useRef<ArgumentMessage | null>(null);
  const shouldReduceMotion = useReducedMotion() ?? false;
  const vibrationActive = useRef(false);

  const triggerFreezeRef = useRef<(payload: GuardianInterruptPayload, triggerArg: ArgumentMessage | null) => void>(() => {});
  const triggerHapticRef = useRef<(riskLevel: string) => void>(() => {});
  const freezeHandleResumedRef = useRef<() => void>(() => {});

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

  const handleAcknowledge = useCallback(() => {
    setIsDataStale(false);
  }, []);

  const handleStatusUpdate = useCallback((payload: { status: string }) => {
    const valid: string[] = ["running", "completed", "paused", "cancelled"];
    if (valid.includes(payload.status)) {
      setDebateStatus(payload.status as "running" | "completed" | "paused" | "cancelled");
    }
  }, []);

  const triggerHaptic = useCallback(
    (riskLevel: string) => {
      if (riskLevel !== "critical") return;
      try {
        if (typeof navigator !== "undefined" && navigator.vibrate && !shouldReduceMotion) {
          navigator.vibrate([100, 50, 100]);
          vibrationActive.current = true;
        }
      } catch {
        // vibration not supported
      }
    },
    [shouldReduceMotion]
  );

  useEffect(() => {
    triggerHapticRef.current = triggerHaptic;
  }, [triggerHaptic]);

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
    triggerHapticRef.current(payload.riskLevel);
  }, []);

  const handleDebateResumed = useCallback(() => {
    freezeHandleResumedRef.current();
  }, []);

  const { status, sendGuardianAck } = useDebateSocket({
    debateId,
    onTokenReceived: handleTokenReceived,
    onArgumentComplete: handleArgumentComplete,
    onDataStale: handleDataStale,
    onDataRefreshed: handleDataRefreshed,
    onReasoningNode: handleReasoningNode,
    onGuardianInterrupt: handleGuardianInterrupt,
    onDebateResumed: handleDebateResumed,
    onStatusUpdate: handleStatusUpdate,
  });

  const {
    state: freezeState,
    isFrozen,
    triggerFreeze,
    acknowledgeFreeze,
    ignoreFreeze,
    retryAck,
    clearFreeze,
    handleDebateResumed: freezeHandleResumed,
  } = useGuardianFreeze({ sendGuardianAck });

  useEffect(() => {
    triggerFreezeRef.current = triggerFreeze;
  }, [triggerFreeze]);

  useEffect(() => {
    freezeHandleResumedRef.current = freezeHandleResumed;
  }, [freezeHandleResumed]);

  const { nodes: graphNodes, edges: graphEdges, onNodesChange, onEdgesChange } = useReasoningGraph(reasoningNodes);

  const { vote, userVote, voteStatus } = useVote(debateId);
  const { hasVoted, voteCounts, totalVotes, serverStatus } = useVotingStatus(debateId);
  const showSentiment = hasVoted || voteStatus === "voted";

  useEffect(() => {
    if (serverStatus && ["running", "completed", "paused", "cancelled"].includes(serverStatus)) {
      setDebateStatus(serverStatus as "running" | "completed" | "paused" | "cancelled");
    }
  }, [serverStatus]);

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
      <GuardianOverlay
        state={freezeState}
        onUnderstand={acknowledgeFreeze}
        onIgnore={ignoreFreeze}
        onRetry={retryAck}
        onClear={clearFreeze}
        shouldReduceMotion={!!shouldReduceMotion}
      />
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
          className
        )}
        style={{
          filter: isFrozen ? "grayscale(60%)" : isDataStale ? "grayscale(100%)" : "none",
          transition: shouldReduceMotion ? "none" : "filter 0.3s ease",
        }}
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
                    </div>
                  </div>
                ) : (
                  <ArgumentBubble
                    agent={message.agent}
                    content={message.content}
                    timestamp={message.timestamp}
                    isRedacted={message.isRedacted}
                  />
                )}
              </div>
            );
          })}
        </div>

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

      {showSentiment ? (
        <SentimentReveal
          voteBreakdown={voteCounts}
          totalVotes={totalVotes}
        />
      ) : (
        <VoteControls
          vote={vote}
          userVote={userVote}
          voteStatus={voteStatus}
          disabled={status !== "connected" || debateStatus !== "running"}
          isFrozen={isFrozen}
        />
      )}
    </>
  );
}
