import type { ArgumentMessage } from "../types/snapshot";
import { cn } from "@/lib/utils";
import { truncateUnicode } from "../utils/truncate";
import { StaticAgentIcon } from "./StaticAgentIcon";

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
  const truncated = truncateUnicode(message.content, MAX_CONTENT_LENGTH);

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
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
          isBull
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-rose-500/20 text-rose-400",
        )}
        aria-hidden="true"
      >
        <StaticAgentIcon agent={message.agent} size={14} />
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
