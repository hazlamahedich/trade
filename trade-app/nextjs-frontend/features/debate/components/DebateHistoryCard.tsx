import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { DebateVoteBar } from "./DebateVoteBar";
import { extractVotes } from "@/features/debate/api/debate-history";
import { formatRelativeTime } from "@/features/debate/utils/format-time";
import { getWinnerBadge } from "@/features/debate/utils/winner-badge";
import type { DebateHistoryItem } from "@/features/debate/types/debate-history";

interface DebateHistoryCardProps {
  debate: DebateHistoryItem;
  thesisPreview?: string;
}

export function DebateHistoryCard({
  debate,
  thesisPreview,
}: DebateHistoryCardProps) {
  const badge = getWinnerBadge(debate.winner);
  const votes = extractVotes(debate.voteBreakdown);

  return (
    <article aria-label={`Debate for ${debate.asset}`}>
      <Link href={`/debates/${debate.externalId}`}>
        <div className="rounded-lg border border-glass bg-white/5 p-4 hover:bg-white/[0.08] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xl font-bold text-slate-100">
              {debate.asset.toUpperCase()}
            </span>
            <Badge
              variant="outline"
              className={`${badge.colorClass} font-semibold`}
            >
              <span aria-hidden="true">{badge.icon}</span>
              <span className="ml-1">{badge.label}</span>
            </Badge>
          </div>

          <DebateVoteBar bullVotes={votes.bullVotes} bearVotes={votes.bearVotes} undecidedVotes={votes.undecidedVotes} />

          <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
            <span>{formatRelativeTime(debate.createdAt)}</span>
            <div className="flex items-center gap-3">
              {debate.guardianVerdict && (
                <span className="flex items-center gap-1" title="Guardian intervened">
                  <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">Guardian: {debate.guardianVerdict}</span>
                </span>
              )}
              <span>{debate.totalVotes} votes</span>
            </div>
          </div>

          {thesisPreview && (
            <p className="mt-2 text-xs text-slate-400 line-clamp-2">
              {thesisPreview}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}
