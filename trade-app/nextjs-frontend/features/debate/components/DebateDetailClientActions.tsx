"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trackEvent } from "@/features/debate/utils/analytics";
import { ShareDebateButton } from "./ShareDebateButton";

export function BackToHistoryLink() {
  return (
    <Link
      href="/dashboard/debates"
      onClick={() =>
        trackEvent({
          name: "debate_detail_back_clicked",
          properties: { source: "debate_detail_page" },
        })
      }
      className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6 min-h-[44px] min-w-[44px]"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to Debate History
    </Link>
  );
}

export function WatchLiveCTA({ externalId }: { externalId: string }) {
  return (
    <Link
      href="/"
      onClick={() =>
        trackEvent({
          name: "debate_detail_cta_clicked",
          properties: {
            source: "debate_detail_page",
            external_id: externalId,
          },
        })
      }
      className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 min-h-[44px]"
    >
      Watch Live Debates
    </Link>
  );
}

export function DebateDetailActions({
  externalId,
  assetName,
  debateStatus,
}: {
  externalId: string;
  assetName: string;
  debateStatus?: "active" | "running" | "completed";
}) {
  return (
    <div className="flex items-center gap-3">
      <WatchLiveCTA externalId={externalId} />
      <ShareDebateButton
        assetName={assetName}
        externalId={externalId}
        debateStatus={debateStatus}
        source="debate_detail"
      />
    </div>
  );
}
