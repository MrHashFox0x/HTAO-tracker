"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { fetchCandles } from "@/lib/useHL";
import { CANDLE_INTERVALS, type Candle } from "@/lib/hl";
import { Panel } from "./Panel";
import type { DailyDerived } from "./StatsBar";

function deriveDaily(candles: Candle[]): DailyDerived {
  const cutoff = Date.now() - 86_400_000;
  const recent = candles.filter((c) => c.T >= cutoff);
  if (!recent.length) return { high: null, low: null, trades: null };
  return {
    high: Math.max(...recent.map((c) => +c.h)),
    low: Math.min(...recent.map((c) => +c.l)),
    trades: recent.reduce((s, c) => s + (c.n || 0), 0),
  };
}

export function PriceChart({
  interval,
  onIntervalChange,
  liveCandle,
  onDaily,
}: {
  interval: string;
  onIntervalChange: (v: string) => void;
  liveCandle: Candle | null;
  onDaily?: (d: DailyDerived) => void;
}) {
  const [loading, setLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const dataRef = useRef<Map<number, Candle>>(new Map()); // t -> candle, current interval

  // build chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#86a494",
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#1d3327" },
        horzLines: { color: "#1d3327" },
      },
      rightPriceScale: { borderColor: "#2e4d3a" },
      timeScale: { borderColor: "#2e4d3a", timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: "#86a49488", labelBackgroundColor: "#446a52" },
        horzLine: { color: "#86a49488", labelBackgroundColor: "#446a52" },
      },
      autoSize: true,
    });
    const candle = chart.addCandlestickSeries({
      upColor: "#3ecf8e",
      downColor: "#e66767",
      wickUpColor: "#3ecf8e",
      wickDownColor: "#e66767",
      borderVisible: false,
    });
    const vol = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chartRef.current = chart;
    candleRef.current = candle;
    volRef.current = vol;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // load history whenever interval changes
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCandles(interval)
      .then((data) => {
        if (!alive || !candleRef.current || !volRef.current) return;
        const sorted = [...data].sort((a, b) => a.t - b.t);
        dataRef.current = new Map(sorted.map((c) => [c.t, c]));
        candleRef.current.setData(
          sorted.map((c) => ({
            time: (c.t / 1000) as UTCTimestamp,
            open: +c.o,
            high: +c.h,
            low: +c.l,
            close: +c.c,
          })),
        );
        volRef.current.setData(
          sorted.map((c) => ({
            time: (c.t / 1000) as UTCTimestamp,
            value: +c.v,
            color: +c.c >= +c.o ? "#3ecf8e40" : "#e6676740",
          })),
        );
        chartRef.current?.timeScale().fitContent();
        onDaily?.(deriveDaily(sorted));
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [interval, onDaily]);

  // apply live candle updates (same interval) without refetching history
  useEffect(() => {
    if (!liveCandle || liveCandle.i !== interval) return;
    if (!candleRef.current || !volRef.current) return;
    dataRef.current.set(liveCandle.t, liveCandle);
    const time = (liveCandle.t / 1000) as UTCTimestamp;
    candleRef.current.update({
      time,
      open: +liveCandle.o,
      high: +liveCandle.h,
      low: +liveCandle.l,
      close: +liveCandle.c,
    });
    volRef.current.update({
      time,
      value: +liveCandle.v,
      color: +liveCandle.c >= +liveCandle.o ? "#3ecf8e40" : "#e6676740",
    });
    onDaily?.(deriveDaily([...dataRef.current.values()].sort((a, b) => a.t - b.t)));
  }, [liveCandle, interval, onDaily]);

  return (
    <Panel
      title="Price / Volume"
      className="h-[520px]"
      bodyClassName="flex flex-col"
      right={
        <div className="flex items-center gap-1">
          {CANDLE_INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => onIntervalChange(iv.value)}
              className={`rounded-[5px] px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                interval === iv.value
                  ? "bg-accent text-page"
                  : "border border-edge bg-surface-2 text-ink-2 hover:bg-surface-3"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="relative m-2 flex-1 overflow-hidden rounded-md">
        <div ref={containerRef} className="absolute inset-0" />
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-3">
            loading candles…
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
