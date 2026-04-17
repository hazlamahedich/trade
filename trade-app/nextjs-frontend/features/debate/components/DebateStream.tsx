"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { useDebateMessages } from "../hooks/useDebateMessages";
import { useVote } from "../hooks/useVote";
import { useVotingStatus } from "../hooks/useVotingStatus";
import { useFirstVoter } from "../hooks/useFirstVoter";
import { useSnapshot, SNAPSHOT_HIDDEN_STATUSES } from "../hooks/useSnapshot";
import { useQuoteShareFromStream } from "../hooks/useQuoteShareFromStream";
import { ArgumentBubble } from "./ArgumentBubble";
import { TypingIndicator } from "./TypingIndicator";
import { StaleDataWarning } from "./StaleDataWarning";
import { GuardianOverlay } from "./GuardianOverlay";
import { VoteControls } from "./VoteControls";
import { DebateToolbar } from "./DebateToolbar";
import { SnapshotOverlay } from "./SnapshotOverlay";
import { DebateMessageList } from "./DebateMessageList";
import type { OptimisticSegment, OptimisticStatus } from "./SentimentReveal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ReasoningGraph = dynamic(
  () => import("./graph/ReasoningGraphWrapper").then((mod) => mod.ReasoningGraph),
  { ssr: false }
);

const LazySentimentReveal = dynamic(
  () => import("./SentimentReveal").then((mod) => mod.SentimentReveal),
  { ssr: false }
);

export type { ArgumentMessage } from "../hooks/useDebateMessages";
export type { AgentType } from "./ArgumentBubble";

interface DebateStreamProps {
  debateId: string;
  assetName?: string;
  externalId?: string;
  className?: string;
}

export function DebateStream({ debateId, assetName: assetNameProp, externalId: externalIdProp, className }: DebateStreamProps) {
  const [userScrolled, setUserScrolled] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion() ?? false;

  const {
    messages,
    streamingText,
    isStreaming,
    currentAgent,
    isDataStale,
    stalePayload,
    debateStatus,
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
  } = useDebateMessages(debateId, shouldReduceMotion);

  const { vote, userVote, voteStatus } = useVote(debateId);
  const wsConnected = wsStatus === "connected";
  const { hasVoted, voteCounts, totalVotes, serverStatus } = useVotingStatus(debateId, { wsConnected });
  const isFirstVoter = useFirstVoter(totalVotes, debateId, hasVoted);
  const showSentiment = hasVoted || voteStatus === "voted";

  const optimisticSegment: OptimisticSegment = userVote ?? null;
  const optimisticStatus: OptimisticStatus | undefined =
    voteStatus === "voting" ? "pending"
    : voteStatus === "voted" ? "confirmed"
    : voteStatus === "error" ? "failed"
    : undefined;

  const optimisticTimerRef = useRef(voteStatus);
  optimisticTimerRef.current = voteStatus;

  useEffect(() => {
    if (!userVote) return;
    const timer = setTimeout(() => {
      if (optimisticTimerRef.current === "voting") {
        toast.info("Still Counting — Your vote is being processed. We'll update shortly.", {
          duration: 6000,
        });
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [userVote]);

  useEffect(() => {
    if (serverStatus && ["running", "completed", "paused", "cancelled"].includes(serverStatus)) {
      // debateStatus is managed by useDebateMessages via WS
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

  const snapshotInput = useMemo(() => ({
    debateId,
    assetName: assetNameProp ?? debateId,
    externalId: externalIdProp ?? debateId,
    messages,
    voteData: {
      bullVotes: voteCounts?.bull ?? 0,
      bearVotes: voteCounts?.bear ?? 0,
    },
  }), [debateId, assetNameProp, externalIdProp, messages, voteCounts]);

  const { generateSnapshot, state: snapshotState, overlayVisible, overlayRef, resetState, successAnnouncement } = useSnapshot(snapshotInput);
  const showSnapshot = !isEmpty && !SNAPSHOT_HIDDEN_STATUSES.has(debateStatus);

  const {
    quoteShareState,
    activeShareId,
    handleShareMessage,
    quoteOverlay,
  } = useQuoteShareFromStream({
    assetName: assetNameProp ?? debateId,
    externalId: externalIdProp ?? debateId,
    snapshotState,
  });

  return (
    <>
      {isDataStale && stalePayload && (
        <StaleDataWarning
          lastUpdate={stalePayload.lastUpdate}
          ageSeconds={stalePayload.ageSeconds}
          onAcknowledge={acknowledgeStale}
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
        <DebateToolbar
          showSnapshot={showSnapshot}
          onGenerateSnapshot={generateSnapshot}
          snapshotState={snapshotState}
          onResetSnapshotState={resetState}
          snapshotSuccessAnnouncement={successAnnouncement}
          assetName={assetNameProp || debateId}
          externalId={externalIdProp || debateId}
          hasExternalId={!!externalIdProp}
        />
        {isEmpty && (
          <div
            data-testid="debate-stream-empty"
            className="flex-1 flex items-center justify-center text-slate-400"
          >
            <p>Waiting for debate to start...</p>
          </div>
        )}

        <DebateMessageList
          messages={messages}
          parentRef={parentRef}
          onShareMessage={handleShareMessage}
          activeShareId={activeShareId}
          shareState={quoteShareState}
        />

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

        {graphNodes.length > 0 && (
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
          data-status={wsStatus}
          className="fixed bottom-4 right-4"
        >
          {wsStatus !== "connected" && (
            <span className="text-xs text-secondary-safe">
              {wsStatus === "connecting" ? "Reconnecting..." : "Disconnected"}
            </span>
          )}
        </div>
      </div>

      {showSentiment ? (
        <LazySentimentReveal
          voteBreakdown={voteCounts}
          totalVotes={totalVotes}
          optimisticSegment={optimisticSegment}
          optimisticStatus={optimisticStatus}
          isFirstVoter={isFirstVoter}
          debateId={debateId}
        />
      ) : (
        <VoteControls
          vote={vote}
          userVote={userVote}
          voteStatus={voteStatus}
          disabled={wsStatus !== "connected" || debateStatus !== "running"}
          isFrozen={isFrozen}
        />
      )}
      {overlayVisible && (
        <SnapshotOverlay
          {...snapshotInput}
          overlayRef={overlayRef}
        />
      )}
      {quoteOverlay}
    </>
  );
}
