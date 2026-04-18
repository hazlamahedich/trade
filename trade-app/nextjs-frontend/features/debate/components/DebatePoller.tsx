"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import type { DebateDetailData } from "@/features/debate/types/debate-detail";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_DURATION_MS = 180_000;

interface DebatePollerProps {
  debateId: string;
  initialData: DebateDetailData;
  children: (data: DebateDetailData) => React.ReactNode;
}

export function DebatePoller({ debateId, initialData, children }: DebatePollerProps) {
  const [data, setData] = useState(initialData);
  const [polling, setPolling] = useState(initialData.status === "running");
  const startTimeRef = useRef(Date.now());

  const poll = useCallback(async () => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    try {
      const res = await fetch(
        `${apiBase}/api/debate/${debateId}/result?include_transcript=true`
      );
      if (!res.ok) return;

      const json = await res.json();
      if (json?.data) {
        const freshData = {
          ...json.data,
          transcript: json.data.transcript ?? null,
          tradingAnalysis: normalizeTradingAnalysis(json.data.tradingAnalysis),
        };
        setData(freshData as DebateDetailData);

        if (freshData.status === "completed" || freshData.status === "failed") {
          setPolling(false);
        }
      }
    } catch {
      // ignore poll failures — will retry
    }
  }, [debateId]);

  useEffect(() => {
    if (!polling) return;

    if (initialData.status !== "running") {
      setPolling(false);
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed > MAX_POLL_DURATION_MS) {
      setPolling(false);
      return;
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [polling, initialData.status, poll]);

  if (data.status === "running" && polling) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-slate-700" />
          <div className="absolute inset-0 h-20 w-20 rounded-full border-4 border-t-emerald-400 animate-spin" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-100 mb-2">
            AI Debate in Progress
          </h2>
          <p className="text-sm text-slate-400 max-w-md">
            Bull and Bear agents are debating {data.asset.toUpperCase()}.
            This usually takes 1–2 minutes. The page will update automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          <span>Polling for updates...</span>
        </div>
      </div>
    );
  }

  if (data.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="rounded-full bg-rose-500/10 p-4">
          <svg className="h-10 w-10 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-100 mb-2">Debate Failed</h2>
          <p className="text-sm text-slate-400">
            The debate for {data.asset.toUpperCase()} encountered an error. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return <>{children(data)}</>;
}

function normalizeTradingAnalysis(
  ta: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!ta) return null;
  const { buyZone, ...rest } = ta as Record<string, unknown> & { buyZone?: unknown };
  return { ...rest, entryZone: rest.entryZone ?? buyZone ?? null };
}
