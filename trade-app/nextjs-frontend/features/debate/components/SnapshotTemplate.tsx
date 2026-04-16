import type { SnapshotInput } from "../types/snapshot";
import { computePercentages } from "../utils/percentages";
import { SnapshotArgumentBubble } from "./SnapshotArgumentBubble";

const MAX_MESSAGES = 50;
const MAX_ASSET_LENGTH = 20;

function truncateAssetName(name: string): string {
  const chars = Array.from(name);
  if (chars.length <= MAX_ASSET_LENGTH) return name;
  return chars.slice(0, MAX_ASSET_LENGTH).join("") + "…";
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white font-bold text-xs">
        T
      </span>
      <span className="text-white font-semibold text-sm tracking-tight">
        AI Trading Debate Lab
      </span>
    </div>
  );
}

export function SnapshotTemplate({
  assetName,
  externalId,
  messages,
  voteData,
  timestamp,
}: SnapshotInput) {
  const argumentMessages = messages.filter((m) => m.type === "argument");
  const totalArgs = argumentMessages.length;
  const truncated = totalArgs > MAX_MESSAGES;
  const displayedMessages = truncated
    ? argumentMessages.slice(-MAX_MESSAGES)
    : argumentMessages;
  const { bullPct, bearPct } = computePercentages(
    voteData.bullVotes,
    voteData.bearVotes,
    voteData.undecidedVotes ?? 0,
  );
  const totalVotes = voteData.bullVotes + voteData.bearVotes + (voteData.undecidedVotes ?? 0);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const debateUrl = siteUrl ? `${siteUrl}/debates/${externalId}` : null;
  const now = timestamp ?? new Date().toISOString();

  return (
    <div
      data-testid="snapshot-template"
      style={{ width: 600 }}
      className="bg-slate-900 text-slate-200 p-6 font-sans"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/15">
        <BrandMark />
        <time className="text-[10px] text-slate-500" dateTime={now}>
          {now.replace("T", " ").slice(0, 19)} UTC
        </time>
      </div>

      <div className="mb-3">
        <h2 className="text-lg font-bold text-white">
          {truncateAssetName(assetName)}
        </h2>
        {truncated && (
          <p className="text-[10px] text-slate-500 mt-0.5">
            Showing {MAX_MESSAGES} of {totalArgs} arguments
          </p>
        )}
      </div>

      {displayedMessages.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
          No arguments yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayedMessages.map((msg) =>
            msg.type === "argument" ? (
              <SnapshotArgumentBubble key={msg.id} message={msg} />
            ) : null,
          )}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-white/15">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>
            Bull {bullPct}% ({voteData.bullVotes})
          </span>
          <span>
            Bear {bearPct}% ({voteData.bearVotes})
          </span>
        </div>
        <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-slate-800">
          <div
            className="bg-emerald-500 rounded-l-full"
            style={{ width: `${bullPct}%` }}
          />
          <div
            className="bg-rose-500 rounded-r-full"
            style={{ width: `${bearPct}%` }}
          />
        </div>
        {totalVotes > 0 && (
          <p className="text-[10px] text-slate-500 mt-1 text-center">
            {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
          </p>
        )}
        {debateUrl && (
          <p className="text-[10px] text-slate-600 mt-2 text-center break-all">
            {debateUrl}
          </p>
        )}
      </div>
    </div>
  );
}
