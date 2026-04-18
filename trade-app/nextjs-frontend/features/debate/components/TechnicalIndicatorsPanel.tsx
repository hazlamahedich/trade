"use client";

import type { TechnicalIndicators, ForexMeta } from "../types/debate-detail";

interface TechnicalIndicatorsPanelProps {
  technicals: TechnicalIndicators;
  forexMeta?: ForexMeta | null;
}

function RsiGauge({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  let color = "text-slate-400";
  let bg = "bg-slate-600";
  if (pct > 70) { color = "text-rose-400"; bg = "bg-rose-500"; }
  else if (pct < 30) { color = "text-emerald-400"; bg = "bg-emerald-500"; }
  else { color = "text-amber-400"; bg = "bg-amber-500"; }

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-slate-700 overflow-hidden" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`RSI(14): ${value.toFixed(1)}`}>
        <div className={`h-full rounded-full ${bg} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono w-10 text-right ${color}`}>{value.toFixed(1)}</span>
    </div>
  );
}

function IndicatorRow({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-b-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-mono text-slate-200">{value}{suffix && <span className="text-slate-500 ml-1">{suffix}</span>}</span>
    </div>
  );
}

export function TechnicalIndicatorsPanel({ technicals, forexMeta }: TechnicalIndicatorsPanelProps) {
  return (
    <section aria-label="Technical indicators" className="rounded-lg border border-white/15 bg-slate-900/50 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Technical Indicators</h3>

      <div className="space-y-3">
        {technicals.rsi14 !== null && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">RSI(14)</span>
              <span className="text-xs text-slate-500">
                {technicals.rsi14 > 70 ? "Overbought" : technicals.rsi14 < 30 ? "Oversold" : "Neutral"}
              </span>
            </div>
            <RsiGauge value={technicals.rsi14} />
          </div>
        )}

        <div className="border-t border-white/5 pt-2 space-y-0">
          {technicals.sma20 !== null && (
            <IndicatorRow label="SMA 20" value={technicals.sma20.toLocaleString(undefined, { maximumFractionDigits: 4 })} />
          )}
          {technicals.sma50 !== null && (
            <IndicatorRow label="SMA 50" value={technicals.sma50.toLocaleString(undefined, { maximumFractionDigits: 4 })} />
          )}
          {technicals.atr14 !== null && (
            <IndicatorRow label="ATR(14)" value={technicals.atr14.toLocaleString(undefined, { maximumFractionDigits: 4 })} />
          )}
          {technicals.change24h !== null && (
            <IndicatorRow
              label="24h Change"
              value={`${technicals.change24h >= 0 ? "+" : ""}${technicals.change24h.toFixed(2)}%`}
            />
          )}
          {technicals.change7d !== null && (
            <IndicatorRow
              label="7d Change"
              value={`${technicals.change7d >= 0 ? "+" : ""}${technicals.change7d.toFixed(2)}%`}
            />
          )}
          {technicals.volumeRatio !== null && (
            <IndicatorRow label="Vol Ratio" value={`${technicals.volumeRatio.toFixed(2)}x`} suffix="vs 20d avg" />
          )}
        </div>

        {technicals.macd && (
          <div className="border-t border-white/5 pt-2">
            <span className="text-xs text-slate-400">MACD</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[10px] text-slate-500">MACD</div>
                <div className="text-xs font-mono text-slate-200">{technicals.macd.macd.toFixed(4)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500">Signal</div>
                <div className="text-xs font-mono text-slate-200">{technicals.macd.signal.toFixed(4)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500">Hist</div>
                <div className={`text-xs font-mono ${technicals.macd.histogram >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {technicals.macd.histogram.toFixed(4)}
                </div>
              </div>
            </div>
          </div>
        )}

        {technicals.bollingerBands && (
          <div className="border-t border-white/5 pt-2">
            <span className="text-xs text-slate-400">Bollinger Bands</span>
            <div className="mt-1 space-y-0">
              <IndicatorRow label="Upper" value={technicals.bollingerBands.upper.toLocaleString(undefined, { maximumFractionDigits: 4 })} />
              <IndicatorRow label="Middle" value={technicals.bollingerBands.middle.toLocaleString(undefined, { maximumFractionDigits: 4 })} />
              <IndicatorRow label="Lower" value={technicals.bollingerBands.lower.toLocaleString(undefined, { maximumFractionDigits: 4 })} />
            </div>
          </div>
        )}

        {technicals.supportLevels && technicals.supportLevels.length > 0 && (
          <div className="border-t border-white/5 pt-2">
            <span className="text-xs text-slate-400">Support</span>
            <div className="flex gap-2 mt-1">
              {technicals.supportLevels.map((s, i) => (
                <span key={i} className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                  {s.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              ))}
            </div>
          </div>
        )}

        {technicals.resistanceLevels && technicals.resistanceLevels.length > 0 && (
          <div className="border-t border-white/5 pt-2">
            <span className="text-xs text-slate-400">Resistance</span>
            <div className="flex gap-2 mt-1">
              {technicals.resistanceLevels.map((r, i) => (
                <span key={i} className="text-xs font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400">
                  {r.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              ))}
            </div>
          </div>
        )}

        {forexMeta && (
          <div className="border-t border-white/5 pt-2 space-y-0">
            <span className="text-xs text-slate-400">Forex Details</span>
            <IndicatorRow label="Pair" value={forexMeta.pair} />
            {forexMeta.spread !== null && <IndicatorRow label="Spread" value={forexMeta.spread.toString()} />}
            {forexMeta.pipValue !== null && <IndicatorRow label="Pip Value" value={forexMeta.pipValue.toString()} />}
            {forexMeta.lotSize !== null && <IndicatorRow label="Lot Size" value={forexMeta.lotSize.toLocaleString()} />}
          </div>
        )}
      </div>
    </section>
  );
}
