"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, CandlestickSeries, HistogramSeries, ColorType } from "lightweight-charts";

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
  buyZone?: { low: number; high: number } | null;
  height?: number;
}

export function CandlestickChart({
  candles,
  supportLevels = [],
  resistanceLevels = [],
  height = 360,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      height,
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
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: false,
      },
      crosshair: {
        horzLine: { color: "rgba(255,255,255,0.2)", labelBackgroundColor: "#334155" },
        vertLine: { color: "rgba(255,255,255,0.2)", labelBackgroundColor: "#334155" },
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    const chartData = candles.map((c) => ({
      time: c.time as import("lightweight-charts").UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candlestickSeries.setData(chartData);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as import("lightweight-charts").UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.2)",
      })),
    );

    for (const level of supportLevels) {
      candlestickSeries.createPriceLine({
        price: level,
        color: "rgba(16,185,129,0.5)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `S: $${level.toLocaleString()}`,
      });
    }

    for (const level of resistanceLevels) {
      candlestickSeries.createPriceLine({
        price: level,
        color: "rgba(244,63,94,0.5)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `R: $${level.toLocaleString()}`,
      });
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
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
  }, [candles, supportLevels, resistanceLevels, height]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg border border-white/10 bg-slate-900/50"
      role="img"
      aria-label="Price chart with candlesticks showing 30-day price history"
    />
  );
}
