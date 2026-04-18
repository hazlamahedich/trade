"use client";

import { useEffect, useState } from "react";
import { CandlestickChart } from "./CandlestickChart";
import { TradingSignalCard } from "./TradingSignalCard";
import { ForexPriceTicker } from "./ForexPriceTicker";
import { TechnicalIndicatorsPanel } from "./TechnicalIndicatorsPanel";
import type { TradingAnalysis, CandleData, TechnicalIndicators } from "@/features/debate/types/debate-detail";

interface DebateChartAndAnalysisProps {
  asset: string;
  analysis: TradingAnalysis | null;
}

function isForexAsset(asset: string): boolean {
  const upper = asset.toUpperCase();
  if (["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY"].includes(upper)) return true;
  if (upper.includes("/")) return true;
  if (upper.length === 6 && /^[A-Z]{6}$/.test(upper)) return true;
  return false;
}

export function DebateChartAndAnalysis({ asset, analysis }: DebateChartAndAnalysisProps) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [technicals, setTechnicals] = useState<TechnicalIndicators | null>(null);
  const [initialPrice, setInitialPrice] = useState<number | null>(null);

  const forex = isForexAsset(asset);

  const forexMeta = forex ? (() => {
    const upper = asset.toUpperCase().replace("/", "");
    const base = upper.slice(0, 3);
    const quote = upper.slice(3, 6);
    return {
      pair: `${base}/${quote}`,
      baseCurrency: base,
      quoteCurrency: quote,
      spread: null,
      pipValue: quote === "JPY" ? 0.01 : 0.0001,
      lotSize: 100000,
    };
  })() : null;

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

    fetch(`${apiBase}/api/market/${asset}/candles?period=30d&interval=1d`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.data && Array.isArray(data.data)) {
          setCandles(data.data);
          if (data.data.length > 0) {
            setInitialPrice(data.data[data.data.length - 1].close);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    if (forex) {
      fetch(`${apiBase}/api/market/${asset}/technical`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.data) {
            const d = data.data;
            setTechnicals({
              rsi14: d.rsi_14 ?? d.rsi14 ?? null,
              macd: d.macd ?? null,
              sma20: d.sma_20 ?? d.sma20 ?? null,
              sma50: d.sma_50 ?? d.sma50 ?? null,
              bollingerBands: d.bollinger_bands ?? d.bollingerBands ?? null,
              atr14: d.atr_14 ?? d.atr14 ?? null,
              change24h: d.change_24h ?? d.change24h ?? null,
              change7d: d.change_7d ?? d.change7d ?? null,
              volumeRatio: d.volume_ratio ?? d.volumeRatio ?? null,
              supportLevels: d.support_levels ?? d.supportLevels ?? null,
              resistanceLevels: d.resistance_levels ?? d.resistanceLevels ?? null,
            });
          }
        })
        .catch(() => {});

      fetch(`${apiBase}/api/market/${asset}/data`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.data?.price && !initialPrice) {
            setInitialPrice(data.data.price);
          }
        })
        .catch(() => {});
    }
  }, [asset, forex]);

  return (
    <div className="space-y-6">
      {forex && initialPrice !== null && (
        <ForexPriceTicker asset={asset} initialPrice={initialPrice} priceUpdates={[]} />
      )}

      <section aria-label="Price chart">
        <h2 className="text-lg font-semibold text-slate-200 mb-3">
          {asset.toUpperCase()} Price Chart
        </h2>
        {loading ? (
          <div className="h-[360px] rounded-lg border border-white/15 bg-white/5 animate-pulse" />
        ) : candles.length > 0 ? (
          <CandlestickChart
            candles={candles}
            supportLevels={analysis?.keySupport ?? []}
            resistanceLevels={analysis?.keyResistance ?? []}
            entryZone={analysis?.entryZone ?? null}
          />
        ) : (
          <div className="h-[360px] rounded-lg border border-white/15 bg-white/5 flex items-center justify-center">
            <p className="text-sm text-slate-400">Chart data unavailable</p>
          </div>
        )}
      </section>

      {forex && technicals && (
        <TechnicalIndicatorsPanel technicals={technicals} forexMeta={forexMeta} />
      )}

      {analysis && (
        <TradingSignalCard analysis={analysis} asset={asset} />
      )}
    </div>
  );
}
