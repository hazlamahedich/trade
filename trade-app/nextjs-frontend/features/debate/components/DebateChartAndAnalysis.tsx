"use client";

import { useEffect, useState } from "react";
import { CandlestickChart } from "./CandlestickChart";
import { TradingSignalCard } from "./TradingSignalCard";
import type { TradingAnalysis, CandleData } from "@/features/debate/types/debate-detail";

interface DebateChartAndAnalysisProps {
  asset: string;
  analysis: TradingAnalysis | null;
}

export function DebateChartAndAnalysis({ asset, analysis }: DebateChartAndAnalysisProps) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

    fetch(`${apiBase}/api/market/${asset}/candles?period=30d&interval=1d`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.data && Array.isArray(data.data)) {
          setCandles(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [asset]);

  return (
    <div className="space-y-6">
      <section aria-label="Price chart">
        <h2 className="text-lg font-semibold text-slate-200 mb-3">
          {asset.toUpperCase()} Price Chart
        </h2>
        {loading ? (
          <div className="h-[360px] rounded-lg border border-white/10 bg-white/5 animate-pulse" />
        ) : candles.length > 0 ? (
          <CandlestickChart
            candles={candles}
            supportLevels={analysis?.keySupport ?? []}
            resistanceLevels={analysis?.keyResistance ?? []}
            entryZone={analysis?.entryZone ?? null}
          />
        ) : (
          <div className="h-[360px] rounded-lg border border-white/10 bg-white/5 flex items-center justify-center">
            <p className="text-sm text-slate-400">Chart data unavailable</p>
          </div>
        )}
      </section>

      {analysis && (
        <TradingSignalCard analysis={analysis} asset={asset} />
      )}
    </div>
  );
}
