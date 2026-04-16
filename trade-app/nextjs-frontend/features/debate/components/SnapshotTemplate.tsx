import type { SnapshotInput } from "../types/snapshot";
import { computePercentages } from "../utils/percentages";
import { SnapshotArgumentBubble } from "./SnapshotArgumentBubble";

const MAX_MESSAGES = 50;
const HEAD_COUNT = 5;
const TAIL_COUNT = 5;
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
    ? [...argumentMessages.slice(0, HEAD_COUNT), ...argumentMessages.slice(-TAIL_COUNT)]
    : argumentMessages;
  const { bullPct, bearPct, undecidedPct } = computePercentages(
    voteData.bullVotes,
    voteData.bearVotes,
    voteData.undecidedVotes ?? 0,
  );
  const totalVotes = voteData.bullVotes + voteData.bearVotes + (voteData.undecidedVotes ?? 0);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const debateUrl = siteUrl ? `${siteUrl}/debates/${externalId}` : null;
  const now = timestamp ?? new Date().toISOString();
  const verdict =
    bullPct > bearPct
      ? `Bull leads ${bullPct}% to ${bearPct}%`
      : bearPct > bullPct
        ? `Bear leads ${bearPct}% to ${bullPct}%`
        : `Split ${bullPct}% / ${bearPct}%`;
  const omittedCount = totalArgs - HEAD_COUNT - TAIL_COUNT;

  return (
    <div
      data-testid="snapshot-template"
      style={{ width: 600 }}
      className="bg-slate-900 text-slate-200 p-6 font-sans"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/15">
        <BrandMark />
        <time className="text-[10px] text-slate-400" dateTime={now}>
          {now.replace("T", " ").slice(0, 19)} UTC
        </time>
      </div>

      <div className="mb-3">
        <h2 className="text-lg font-bold text-white">
          {truncateAssetName(assetName)}
        </h2>
        {truncated && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            Highlights from a {totalArgs}-argument debate
          </p>
        )}
      </div>

      {displayedMessages.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
          No arguments yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayedMessages.map((msg, idx) =>
            msg.type === "argument" ? (
              <div key={msg.id}>
                {truncated && idx === HEAD_COUNT && omittedCount > 0 && (
                  <div className="flex items-center justify-center py-2 text-[10px] text-slate-400">
                    {omittedCount} argument{omittedCount !== 1 ? "s" : ""} omitted
                  </div>
                )}
                <SnapshotArgumentBubble message={msg} />
              </div>
            ) : null,
          )}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-white/15">
        <p className="text-sm font-semibold text-white text-center mb-2">
          {verdict}
        </p>
        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>
            Bull {bullPct}% ({voteData.bullVotes})
          </span>
          {voteData.undecidedVotes != null && voteData.undecidedVotes > 0 && (
            <span>
              Undecided {undecidedPct}% ({voteData.undecidedVotes})
            </span>
          )}
          <span>
            Bear {bearPct}% ({voteData.bearVotes})
          </span>
        </div>
        <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-slate-800">
          <div
            className="bg-emerald-500"
            style={{ width: `${bullPct}%` }}
          />
          {undecidedPct > 0 && (
            <div
              className="bg-slate-500"
              style={{ width: `${undecidedPct}%` }}
            />
          )}
          <div
            className="bg-rose-500"
            style={{ width: `${bearPct}%` }}
          />
        </div>
        {totalVotes > 0 && (
          <p className="text-[10px] text-slate-400 mt-1 text-center">
            {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
          </p>
        )}
        {debateUrl && (
          <p className="text-[10px] text-slate-500 mt-2 text-center break-all">
            {debateUrl}
          </p>
        )}
      </div>
    </div>
  );
}
