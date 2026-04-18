"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
} from "lightweight-charts";

interface CandlestickChartProps {
  candles: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  supportLevels?: number[];
  resistanceLevels?: number[];
  entryZone?: { low: number; high: number } | null;
  height?: number;
}

function epochToDateStr(epoch: number): string {
  const d = new Date(epoch * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function computeChartHeight(candles: CandlestickChartProps["candles"], baseHeight: number): number {
  if (candles.length < 3) return baseHeight;
  const prices: number[] = [];
  for (const c of candles) {
    prices.push(c.high, c.low);
  }
  const span = Math.max(...prices) - Math.min(...prices);
  if (span <= 0) return baseHeight;
  let totalBody = 0;
  for (const c of candles) {
    totalBody += Math.abs(c.close - c.open);
  }
  const avgBody = totalBody / candles.length;
  const ratio = span / avgBody;
  if (ratio > 150) return Math.min(baseHeight + 200, 600);
  if (ratio > 80) return Math.min(baseHeight + 120, 540);
  return baseHeight;
}

function computeAutoscaleMargin(candles: CandlestickChartProps["candles"]): number {
  if (candles.length < 3) return 0.05;
  let totalBody = 0;
  let totalRange = 0;
  for (const c of candles) {
    totalBody += Math.abs(c.close - c.open);
    totalRange += c.high - c.low;
  }
  const avgBody = totalBody / candles.length;
  const avgRange = totalRange / candles.length;
  if (avgRange <= 0) return 0.05;
  const bodyToRangeRatio = avgBody / avgRange;
  if (bodyToRangeRatio < 0.15) return 0.005;
  if (bodyToRangeRatio < 0.3) return 0.01;
  if (bodyToRangeRatio < 0.5) return 0.02;
  return 0.05;
}

export function CandlestickChart({
  candles,
  supportLevels = [],
  resistanceLevels = [],
  height = 400,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const chartHeight = computeChartHeight(candles, height);
  const scaleMargin = computeAutoscaleMargin(candles);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      height: chartHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
        autoScale: true,
        scaleMargins: {
          top: scaleMargin,
          bottom: scaleMargin,
        },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: false,
        barSpacing: 12,
        minBarSpacing: 2,
      },
      crosshair: {
        horzLine: {
          color: "rgba(255,255,255,0.2)",
          labelBackgroundColor: "#334155",
        },
        vertLine: {
          color: "rgba(255,255,255,0.2)",
          labelBackgroundColor: "#334155",
        },
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#10b981a0",
      wickDownColor: "#f43f5ea0",
    });

    candlestickSeries.setData(
      candles.map((c) => ({
        time: epochToDateStr(c.time),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    const hasVolume = candles.some((c) => c.volume > 0);

    if (hasVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      volumeSeries.setData(
        candles.map((c) => ({
          time: epochToDateStr(c.time),
          value: c.volume,
          color:
            c.close >= c.open
              ? "rgba(16,185,129,0.2)"
              : "rgba(244,63,94,0.2)",
        })),
      );
    }

    for (const level of supportLevels) {
      candlestickSeries.createPriceLine({
        price: level,
        color: "rgba(16,185,129,0.5)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `S: ${level}`,
      });
    }

    for (const level of resistanceLevels) {
      candlestickSeries.createPriceLine({
        price: level,
        color: "rgba(244,63,94,0.5)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `R: ${level}`,
      });
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, supportLevels, resistanceLevels, chartHeight]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg border border-white/15 bg-slate-900/50"
      role="img"
      aria-label="Price chart showing 30-day price history"
    />
  );
}
