"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ArgumentBubble } from "./ArgumentBubble";
import type { AgentType } from "./ArgumentBubble";
import type { DebateMessage } from "../hooks/useDebateMessages";

export type { ArgumentMessage } from "../hooks/useDebateMessages";
export type { DebateMessage } from "../hooks/useDebateMessages";
export type { AgentType };

interface DebateMessageListProps {
  messages: DebateMessage[];
  parentRef: React.RefObject<HTMLDivElement | null>;
}

export function DebateMessageList({ messages, parentRef }: DebateMessageListProps) {
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (messages[index]?.type === "guardian" ? 120 : 100),
    overscan: 5,
  });

  return (
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
  );
}
