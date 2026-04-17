"use client";

import { TrendingUp, TrendingDown, Minus, Target, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import type { TradingAnalysis } from "@/features/debate/types/debate-detail";

interface TradingSignalCardProps {
  analysis: TradingAnalysis;
  asset: string;
}

function PriceLevel({ label, price, color }: { label: string; price: number; color: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>
        ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

export function TradingSignalCard({ analysis, asset }: TradingSignalCardProps) {
  const { bullScore, direction, confidence, buyZone, stopLoss, takeProfit, riskRewardRatio, keySupport, keyResistance, verdict, watchlist } = analysis;

  const bullPct = Math.round(bullScore);
  const bearPct = 100 - bullPct;

  const directionConfig = {
    bullish: { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Bullish" },
    bearish: { icon: TrendingDown, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", label: "Bearish" },
    neutral: { icon: Minus, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Neutral" },
  };

  const config = directionConfig[direction] || directionConfig.neutral;
  const DirectionIcon = config.icon;

  return (
    <section aria-label="Trading signal analysis" className="rounded-lg border border-white/15 bg-white/5 overflow-hidden">
      <div className={`px-4 py-3 ${config.bg} ${config.border} border-b flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <DirectionIcon className={`h-5 w-5 ${config.color}`} aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-100">
            Trading Signal: {asset.toUpperCase()}
          </h2>
        </div>
        <span className={`text-sm font-semibold ${config.color}`}>
          {config.label} ({confidence}% confidence)
        </span>
      </div>

      <div className="p-4 space-y-5">
        <div aria-label="Bull vs Bear probability">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
              Bull {bullPct}%
            </span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-rose-400">
              Bear {bearPct}%
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="h-3 w-full rounded-full overflow-hidden bg-slate-800 flex gap-[2px]">
            <div
              className="bg-emerald-500 rounded-l-full transition-all duration-500"
              style={{ width: `${bullPct}%` }}
            />
            <div
              className="bg-rose-500 rounded-r-full transition-all duration-500"
              style={{ width: `${bearPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">{analysis.summary}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-md border border-white/10 p-3" aria-label="Buy zone">
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-200">Buy Zone</h3>
            </div>
            {buyZone ? (
              <>
                <p className="font-mono text-emerald-400 text-lg">
                  ${buyZone.low.toLocaleString(undefined, { minimumFractionDigits: 2 })} – ${buyZone.high.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="mt-1 text-xs text-slate-400">{buyZone.rationale}</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Not available</p>
            )}
          </div>

          <div className="grid grid-rows-2 gap-3">
            {stopLoss && (
              <div className="rounded-md border border-rose-500/20 bg-rose-500/5 p-3" aria-label="Stop loss">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                  <h3 className="text-xs font-semibold text-rose-300">Stop Loss</h3>
                </div>
                <p className="font-mono text-sm text-rose-300">
                  ${stopLoss.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{stopLoss.rationale}</p>
              </div>
            )}
            {takeProfit && (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3" aria-label="Take profit">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <h3 className="text-xs font-semibold text-emerald-300">Take Profit</h3>
                </div>
                <p className="font-mono text-sm text-emerald-300">
                  ${takeProfit.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{takeProfit.rationale}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Support</h3>
            {keySupport.map((level, i) => (
              <PriceLevel key={i} label={`S${i + 1}`} price={level} color="text-emerald-400" />
            ))}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Resistance</h3>
            {keyResistance.map((level, i) => (
              <PriceLevel key={i} label={`R${i + 1}`} price={level} color="text-rose-400" />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm border-t border-white/10 pt-3">
          <span className="text-slate-400">Risk/Reward</span>
          <span className="font-mono font-semibold text-slate-200">{riskRewardRatio}</span>
        </div>

        {verdict && (
          <div className="rounded-md bg-white/5 border border-white/10 p-3">
            <h3 className="text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">Verdict</h3>
            <p className="text-sm text-slate-200 leading-relaxed">{verdict}</p>
          </div>
        )}

        {watchlist && watchlist.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Watchlist</h3>
            <ul className="space-y-1">
              {watchlist.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-slate-500 mt-0.5" aria-hidden="true">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-slate-500 italic">
          This is AI-generated analysis for educational purposes only. Not financial advice. Always do your own research.
        </p>
      </div>
    </section>
  );
}
