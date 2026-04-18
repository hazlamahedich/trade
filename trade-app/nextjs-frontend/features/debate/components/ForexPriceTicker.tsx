"use client";

import { useState, useEffect, useRef } from "react";
import type { ForexPriceUpdatePayload } from "../hooks/useDebateSocket";

interface ForexPriceTickerProps {
  asset: string;
  initialPrice: number;
  priceUpdates: ForexPriceUpdatePayload[];
}

function formatForexPrice(price: number, asset: string): string {
  const upper = asset.toUpperCase();
  if (upper.includes("JPY")) return price.toFixed(3);
  return price.toFixed(5);
}

export function ForexPriceTicker({ asset, initialPrice, priceUpdates }: ForexPriceTickerProps) {
  const [currentPrice, setCurrentPrice] = useState(initialPrice);
  const [direction, setDirection] = useState<"up" | "down" | "flat">("flat");
  const [changePct, setChangePct] = useState<number | null>(null);
  const prevPriceRef = useRef(initialPrice);

  useEffect(() => {
    if (priceUpdates.length === 0) return;
    const latest = priceUpdates[priceUpdates.length - 1];
    if (latest.price && latest.price !== currentPrice) {
      prevPriceRef.current = currentPrice;
      setCurrentPrice(latest.price);
      setDirection(latest.price > prevPriceRef.current ? "up" : "down");
      setChangePct(latest.changePct ?? null);
      const timer = setTimeout(() => setDirection("flat"), 2000);
      return () => clearTimeout(timer);
    }
  }, [priceUpdates, currentPrice]);

  const colorClass =
    direction === "up"
      ? "text-emerald-400"
      : direction === "down"
        ? "text-rose-400"
        : "text-slate-200";

  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-slate-900/60 px-4 py-2">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
        {asset.toUpperCase()}
      </span>
      <span className={`text-lg font-mono font-semibold transition-colors duration-300 ${colorClass}`}>
        {arrow} {formatForexPrice(currentPrice, asset)}
      </span>
      {changePct !== null && (
        <span
          className={`text-xs font-mono ${changePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}
          aria-live="polite"
        >
          {changePct >= 0 ? "+" : ""}
          {changePct.toFixed(4)}%
        </span>
      )}
    </div>
  );
}
