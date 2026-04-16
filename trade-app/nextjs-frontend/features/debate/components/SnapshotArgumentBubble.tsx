import type { ArgumentMessage } from "../types/snapshot";
import { cn } from "@/lib/utils";

interface SnapshotArgumentBubbleProps {
  message: ArgumentMessage;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MAX_CONTENT_LENGTH = 500;

export function SnapshotArgumentBubble({ message }: SnapshotArgumentBubbleProps) {
  const isBull = message.agent === "bull";
  const truncated =
    message.content.length > MAX_CONTENT_LENGTH
      ? Array.from(message.content).slice(0, MAX_CONTENT_LENGTH).join("") + "…"
      : message.content;

  return (
    <div
      className={cn(
        "flex gap-2.5 p-3 rounded-lg border text-left",
        isBull
          ? "flex-row bg-emerald-500/10 border-emerald-500/20"
          : "flex-row-reverse bg-rose-500/10 border-rose-500/20",
      )}
    >
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
          isBull
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-rose-500/20 text-rose-400",
        )}
        aria-hidden="true"
      >
        {isBull ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
            <polyline points="16 17 22 17 22 11" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "flex items-center gap-1.5 mb-0.5",
            isBull ? "flex-row" : "flex-row-reverse",
          )}
        >
          <span
            className={cn(
              "font-semibold text-xs",
              isBull ? "text-emerald-400" : "text-rose-400",
            )}
          >
            {isBull ? "Bull" : "Bear"}
          </span>
          <span className="text-[10px] text-slate-400">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <p className="text-slate-200 text-xs leading-relaxed break-words">
          {truncated}
        </p>
      </div>
    </div>
  );
}
