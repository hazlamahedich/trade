"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useDebateSocket, type TokenPayload, type ArgumentPayload } from "../hooks/useDebateSocket";
import { ArgumentBubble, type AgentType } from "./ArgumentBubble";
import { TypingIndicator } from "./TypingIndicator";
import { cn } from "@/lib/utils";

interface Argument {
  id: string;
  agent: AgentType;
  content: string;
  timestamp: string;
}

interface DebateStreamProps {
  debateId: string;
  className?: string;
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function DebateStream({ debateId, className }: DebateStreamProps) {
  const [messages, setMessages] = useState<Argument[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentType | null>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
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

  const { status } = useDebateSocket({
    debateId,
    onTokenReceived: handleTokenReceived,
    onArgumentComplete: handleArgumentComplete,
  });

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
              data-testid={`argument-${message.id}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ArgumentBubble
                agent={message.agent}
                content={message.content}
                timestamp={message.timestamp}
              />
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
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
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
  );
}
