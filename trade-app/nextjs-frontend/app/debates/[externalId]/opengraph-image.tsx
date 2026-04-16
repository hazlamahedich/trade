import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

import type { DebateDetailData } from "@/features/debate/types/debate-detail";
import { getApiBaseUrl } from "@/lib/api/config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Debate preview image \u2014 AI Trading Debate Lab";
export const revalidate = 3600; // keep in sync with DEBATE_DETAIL_ISR_REVALIDATE_SECONDS in page.tsx

async function fetchDebateForOG(
  externalId: string,
): Promise<DebateDetailData | null> {
  try {
    const url = `${getApiBaseUrl()}/api/debate/${encodeURIComponent(externalId)}/result?include_transcript=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.data) return null;
    return json.data as DebateDetailData;
  } catch (error) {
    console.error("[OG Image] fetch failed for", externalId, error);
    return null;
  }
}

function inlineExtractVotes(voteBreakdown: Record<string, number> | null | undefined) {
  if (!voteBreakdown) return { bullVotes: 0, bearVotes: 0, undecidedVotes: 0 };
  return {
    bullVotes: voteBreakdown["bull"] ?? 0,
    bearVotes: voteBreakdown["bear"] ?? 0,
    undecidedVotes: voteBreakdown["undecided"] ?? 0,
  };
}

function inlineComputePercentages(
  bullVotes: number,
  bearVotes: number,
  undecidedVotes: number,
) {
  const total = bullVotes + bearVotes + undecidedVotes;
  if (total === 0) return { bullPct: 0, bearPct: 0, undecidedPct: 0 };

  const bullPct = Math.round((bullVotes / total) * 100);
  const undecidedPct = Math.round((undecidedVotes / total) * 100);
  const bearPct = Math.max(0, 100 - bullPct - undecidedPct);
  return { bullPct, bearPct, undecidedPct };
}

function inlineDeriveWinner(data: DebateDetailData): string {
  const { bullVotes, bearVotes, undecidedVotes } = inlineExtractVotes(
    data.voteBreakdown,
  );
  const total = bullVotes + bearVotes + undecidedVotes;
  if (total === 0) return "undecided";
  if (bullVotes > bearVotes && bullVotes >= undecidedVotes) return "bull";
  if (bearVotes > bullVotes && bearVotes >= undecidedVotes) return "bear";
  return "undecided";
}

function buildDebateImage(data: DebateDetailData, fonts: FontConfig[]) {
  const asset = (data.asset ?? "UNKNOWN").toUpperCase().slice(0, 10);
  const winner = inlineDeriveWinner(data);
  const { bullVotes, bearVotes, undecidedVotes } = inlineExtractVotes(
    data.voteBreakdown,
  );
  const { bullPct, bearPct } = inlineComputePercentages(
    bullVotes,
    bearVotes,
    undecidedVotes,
  );
  const totalVotes = data.totalVotes ?? 0;

  const winnerColors: Record<string, { bg: string; text: string }> = {
    bull: { bg: "#22c55e", text: "#052e16" },
    bear: { bg: "#ef4444", text: "#450a0a" },
    undecided: { bg: "#94a3b8", text: "#1e293b" },
  };
  const wc = winnerColors[winner] ?? winnerColors.undecided;
  const winnerLabel =
    winner.charAt(0).toUpperCase() + winner.slice(1);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#0f172a",
          display: "flex",
          flexDirection: "column",
          padding: "40px",
          fontFamily: "Inter",
          color: "#e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <span
            style={{
              fontSize: "64px",
              fontWeight: 700,
              color: "#f8fafc",
              letterSpacing: "-0.02em",
            }}
          >
            {asset}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: wc.bg,
              color: wc.text,
              padding: "8px 20px",
              borderRadius: "9999px",
              fontSize: "24px",
              fontWeight: 700,
            }}
          >
            {winnerLabel}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "28px",
              borderRadius: "14px",
              overflow: "hidden",
              backgroundColor: "#1e293b",
            }}
          >
            <div
              style={{
                width: `${bullPct}%`,
                height: "100%",
                backgroundColor: "#22c55e",
              }}
            />
            <div
              style={{
                width: `${bearPct}%`,
                height: "100%",
                backgroundColor: "#ef4444",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "12px",
              fontSize: "18px",
              color: "#94a3b8",
            }}
          >
            <span>
              Bull {bullPct}%
            </span>
            <span>
              Bear {bearPct}%
            </span>
          </div>

          <div style={{ marginTop: "16px", fontSize: "22px", color: "#cbd5e1" }}>
            {totalVotes.toLocaleString()} votes
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: "24px",
          }}
        >
          <span style={{ fontSize: "20px", color: "#64748b", fontWeight: 400 }}>
            AI Trading Debate Lab
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}

function buildFallbackImage(fonts: FontConfig[]) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#0f172a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px",
          fontFamily: "Inter",
          color: "#e2e8f0",
        }}
      >
        <span
          style={{
            fontSize: "48px",
            fontWeight: 700,
            color: "#f8fafc",
            marginBottom: "16px",
          }}
        >
          AI Trading Debate Lab
        </span>
        <span style={{ fontSize: "24px", color: "#64748b" }}>
          Watch Bulls &amp; Bears Argue Your Next Trade
        </span>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}

interface FontConfig {
  name: string;
  data: ArrayBuffer;
  style: "normal";
  weight: 400 | 700;
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ externalId: string }>;
}) {
  const { externalId } = await params;

  let fonts: FontConfig[] = [];
  try {
    const [regularData, boldData] = await Promise.all([
      readFile(join(process.cwd(), "app/fonts/Inter-Regular.ttf")),
      readFile(join(process.cwd(), "app/fonts/Inter-Bold.ttf")),
    ]);
    fonts = [
      { name: "Inter", data: regularData, style: "normal", weight: 400 },
      { name: "Inter", data: boldData, style: "normal", weight: 700 },
    ];
  } catch {
    console.error("[OG Image] Font loading failed, using system fonts");
  }

  const data = await fetchDebateForOG(externalId);

  if (!data) {
    return buildFallbackImage(fonts);
  }

  return buildDebateImage(data, fonts);
}
