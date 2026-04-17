"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArgumentBubble } from "./ArgumentBubble";
import type { AgentType } from "./ArgumentBubble";
import type { DebateMessage, ArgumentMessage } from "../hooks/useDebateMessages";
import type { QuoteShareState } from "../types/quote-share";

export type { ArgumentMessage } from "../hooks/useDebateMessages";
export type { DebateMessage } from "../hooks/useDebateMessages";
export type { AgentType };

interface DebateMessageListProps {
  messages: DebateMessage[];
  parentRef: React.RefObject<HTMLDivElement | null>;
  onShareMessage?: (message: ArgumentMessage) => void;
  activeShareId?: string | null;
  shareState?: QuoteShareState;
}

function getArgumentIndices(messages: DebateMessage[]): number[] {
  return messages.reduce<number[]>((acc, m, i) => {
    if (m.type !== "guardian") acc.push(i);
    return acc;
  }, []);
}

const SHARE_HINT_KEY = "quote-share-hint-shown";

export function DebateMessageList({ messages, parentRef, onShareMessage, activeShareId, shareState }: DebateMessageListProps) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [hintShown, setHintShown] = useState(true);
  const argumentIndices = useRef(getArgumentIndices(messages));
  argumentIndices.current = getArgumentIndices(messages);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHintShown(sessionStorage.getItem(SHARE_HINT_KEY) === "1");
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (messages[index]?.type === "guardian" ? 120 : 100),
    overscan: 5,
  });

  const handleArrowNavigation = useCallback(
    (direction: "up" | "down") => {
      const indices = argumentIndices.current;
      if (indices.length === 0) return;

      const currentPos = indices.indexOf(focusedIndex);
      let nextPos: number;

      if (currentPos === -1) {
        nextPos = direction === "down" ? 0 : indices.length - 1;
      } else {
        nextPos =
          direction === "down"
            ? Math.min(currentPos + 1, indices.length - 1)
            : Math.max(currentPos - 1, 0);
      }

      const nextIndex = indices[nextPos];
      setFocusedIndex(nextIndex);
      rowVirtualizer.scrollToIndex(nextIndex, { align: "auto" });
    },
    [focusedIndex, rowVirtualizer],
  );

  const lastArgIdx = argumentIndices.current[argumentIndices.current.length - 1] ?? -1;

  const dismissHint = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SHARE_HINT_KEY, "1");
    }
    setHintShown(true);
  }, []);

  return (
    <div
      style={{
        height: rowVirtualizer.getTotalSize(),
        width: "100%",
        position: "relative",
      }}
      role="list"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          handleArrowNavigation("down");
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          handleArrowNavigation("up");
        }
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const message = messages[virtualRow.index];
        const isFocused = virtualRow.index === focusedIndex;

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
                onShare={onShareMessage ? () => onShareMessage(message as ArgumentMessage) : undefined}
                shareState={activeShareId === message.id ? shareState : undefined}
                isFocused={isFocused}
                onFocusRequest={() => setFocusedIndex(virtualRow.index)}
                showShareHint={!hintShown && onShareMessage !== undefined && virtualRow.index === lastArgIdx}
                onDismissHint={dismissHint}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
