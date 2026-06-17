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
        textColor: "#9fb3aa",
        fontFamily: "var(--font-mono), monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#16221d" },
        horzLines: { color: "#16221d" },
      },
      rightPriceScale: { borderColor: "#26352e" },
      timeScale: { borderColor: "#26352e", timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: "#3bffa688", labelBackgroundColor: "#1aa873" },
        horzLine: { color: "#3bffa688", labelBackgroundColor: "#1aa873" },
      },
      autoSize: true,
    });
    const candle = chart.addCandlestickSeries({
      upColor: "#3bffa6",
      downColor: "#ff6172",
      wickUpColor: "#3bffa6",
      wickDownColor: "#ff6172",
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
            color: +c.c >= +c.o ? "#3bffa655" : "#ff617255",
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
      color: +liveCandle.c >= +liveCandle.o ? "#3bffa655" : "#ff617255",
    });
    onDaily?.(deriveDaily([...dataRef.current.values()].sort((a, b) => a.t - b.t)));
  }, [liveCandle, interval, onDaily]);

  return (
    <Panel
      title="PRICE / VOLUME"
      className="h-[520px]"
      bodyClassName="flex flex-col"
      right={
        <div className="flex gap-1">
          {CANDLE_INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => onIntervalChange(iv.value)}
              className={`px-1.5 py-0.5 text-[11px] tracking-wider transition-colors ${
                interval === iv.value
                  ? "bg-term-green/15 text-term-green"
                  : "text-term-muted hover:text-term-text"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-term-muted">
            loading candles…
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
