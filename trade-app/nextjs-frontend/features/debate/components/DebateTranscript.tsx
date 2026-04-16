import { AgentAvatar } from "./AgentAvatar";
import type { TranscriptMessage } from "@/features/debate/types/debate-detail";

const VISIBLE_MESSAGE_COUNT = 6;

interface DebateTranscriptProps {
  messages: TranscriptMessage[] | null;
}

export function DebateTranscript({ messages }: DebateTranscriptProps) {
  if (!messages || messages.length === 0) {
    return (
      <section aria-label="Debate transcript">
        <p className="text-slate-400 text-sm">Transcript not available</p>
      </section>
    );
  }

  const needsDisclosure = messages.length > VISIBLE_MESSAGE_COUNT;
  const visibleMessages = needsDisclosure
    ? messages.slice(0, VISIBLE_MESSAGE_COUNT)
    : messages;
  const hiddenMessages = needsDisclosure
    ? messages.slice(VISIBLE_MESSAGE_COUNT)
    : [];

  return (
    <section role="log" aria-label="Debate transcript">
      {visibleMessages.map((msg, i) => (
        <article key={i} className="mb-4">
          <TranscriptMessageCard message={msg} />
        </article>
      ))}
      {needsDisclosure && hiddenMessages.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-300 py-2">
            Show full transcript ({hiddenMessages.length} more messages)
          </summary>
          {hiddenMessages.map((msg, i) => (
            <article key={i + VISIBLE_MESSAGE_COUNT} className="mb-4">
              <TranscriptMessageCard message={msg} />
            </article>
          ))}
        </details>
      )}
    </section>
  );
}

function TranscriptMessageCard({ message }: { message: TranscriptMessage }) {
  const role = message.role.toLowerCase();
  const isBull = role === "bull";
  const isBear = role === "bear";
  const isGuardian = role === "guardian" || role === "risk_guardian";
  const displayRole = isBull ? "bull" : isBear ? "bear" : isGuardian ? "guardian" : role;
  const label = isBull ? "Bull Agent" : isBear ? "Bear Agent" : isGuardian ? "Risk Guardian" : role;

  const avatarAgent = isBull ? "bull" as const : "bear" as const;

  return (
    <div
      className={`flex gap-3 ${isBull ? "" : "flex-row-reverse"}`}
    >
      <div className="shrink-0 pt-1">
        <AgentAvatar agent={avatarAgent} size="sm" />
      </div>
      <div
        className={`rounded-lg border border-glass bg-white/5 p-3 max-w-[80%] ${
          isBull ? "border-l-emerald-500/30 border-l-2" : isBear ? "border-r-rose-500/30 border-r-2" : "border-l-amber-500/30 border-l-2"
        }`}
      >
        <p className="text-xs font-semibold text-slate-400 mb-1">
          {label}
        </p>
        <p className="text-sm text-slate-200">{message.content}</p>
      </div>
    </div>
  );
}
