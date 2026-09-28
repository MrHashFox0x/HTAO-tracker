"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { Panel } from "./Panel";
import { useVolumeHistory, type VolumeDay } from "@/lib/useVolumeHistory";
import { usdCompact, compact } from "@/lib/format";

// Cumulative all-time volume (area) + per-day volume (histogram underneath),
// toggleable between USDC notional and HTAO base units. Pre-collector days
// carry a vwap-estimated notional (see useVolumeHistory) and render dimmer.

type Mode = "ntl" | "base";

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

export function VolumeChart() {
  const { days, loading, error, exactSince } = useVolumeHistory();
  const [mode, setMode] = useState<Mode>("ntl");
  const [hovered, setHovered] = useState<VolumeDay | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaRef = useRef<ISeriesApi<"Area"> | null>(null);
  const histRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const byTimeRef = useRef<Map<number, VolumeDay>>(new Map()); // sec -> day

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
      timeScale: { borderColor: "#2e4d3a", timeVisible: false },
      crosshair: {
        vertLine: { color: "#86a49488", labelBackgroundColor: "#446a52" },
        horzLine: { color: "#86a49488", labelBackgroundColor: "#446a52" },
      },
      autoSize: true,
    });
    const area = chart.addAreaSeries({
      lineColor: "#3ecf8e",
      topColor: "rgba(62,207,142,0.14)",
      bottomColor: "rgba(62,207,142,0.01)",
      lineWidth: 2,
      priceLineVisible: false,
    });
    const hist = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "", // overlay, no visible scale
      priceLineVisible: false,
      lastValueVisible: false,
    });
    hist.priceScale().applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });

    chart.subscribeCrosshairMove((param) => {
      setHovered(
        param.time != null ? (byTimeRef.current.get(param.time as number) ?? null) : null,
      );
    });

    chartRef.current = chart;
    areaRef.current = area;
    histRef.current = hist;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // (re)load data on series or mode change
  useEffect(() => {
    if (!chartRef.current || !areaRef.current || !histRef.current || days.length === 0) return;

    chartRef.current.applyOptions({
      localization: { priceFormatter: mode === "ntl" ? usdCompact : compact },
    });
    byTimeRef.current = new Map(days.map((d) => [d.t / 1000, d]));

    areaRef.current.setData(
      days.map((d) => ({
        time: (d.t / 1000) as UTCTimestamp,
        value: mode === "ntl" ? d.cumNtl : d.cumBase,
      })),
    );
    histRef.current.setData(
      days.map((d) => ({
        time: (d.t / 1000) as UTCTimestamp,
        value: mode === "ntl" ? d.ntl : d.base,
        // estimated (pre-collector) days render dimmer than exact ones
        color: d.exact || mode === "base" ? "#3ecf8e40" : "#86a49433",
      })),
    );
    chartRef.current.timeScale().fitContent();
  }, [days, mode]);

  const last = days.length ? days[days.length - 1] : null;
  const shown = hovered ?? last;
  const fmt = mode === "ntl" ? usdCompact : compact;

  return (
    <Panel
      title="Cumulative volume"
      className="h-[300px]"
      bodyClassName="flex flex-col"
      right={
        <div className="flex items-center gap-2">
          {days.length > 0 ? (
            <span className="tnum font-mono">since {day(days[0].t)}</span>
          ) : null}
          <div className="flex gap-1">
            {(
              [
                { value: "ntl", label: "USDC" },
                { value: "base", label: "HTAO" },
              ] as const
            ).map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`rounded-[5px] px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                  mode === m.value
                    ? "bg-accent text-page"
                    : "border border-edge bg-surface-2 text-ink-2 hover:bg-surface-3"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="relative m-2 flex-1 overflow-hidden rounded-md">
        <div ref={containerRef} className="absolute inset-0" />
        {shown ? (
          <div className="pointer-events-none absolute left-2 top-1.5 z-10 flex flex-col gap-0.5 font-mono text-[10px]">
            <span className="tnum text-ink-3">
              {day(shown.t)}
              {mode === "ntl" && !shown.exact ? (
                <span className="text-ink-3" title="notional estimated from 1d candle vwap (pre-collector)">
                  {" "}
                  · est.
                </span>
              ) : null}
            </span>
            <span className="tnum">
              <span className="text-ink-3">day </span>
              <span className="text-ink">{fmt(mode === "ntl" ? shown.ntl : shown.base)}</span>
              <span className="text-ink-3"> · cum </span>
              <span className="font-semibold text-accent">
                {fmt(mode === "ntl" ? shown.cumNtl : shown.cumBase)}
              </span>
            </span>
          </div>
        ) : null}
        {exactSince != null ? (
          <div className="pointer-events-none absolute bottom-1 left-2 z-10 font-mono text-[9px] text-ink-3/80">
            exact (collector) since {day(exactSince)} · earlier days ≈ 1d-candle vwap
          </div>
        ) : null}
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-3">
            loading volume history…
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-sell/80">
            volume history unavailable
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
