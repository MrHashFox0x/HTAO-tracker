"use client";

import type { TraderStat, FlowStats } from "@/lib/useHL";
import { usdSmart, num, pct, ago } from "@/lib/format";
import { Panel } from "./Panel";
import { AddrTag } from "./AddrTag";

const COLS =
  "grid-cols-[2.25rem_minmax(8rem,1fr)_3.5rem_minmax(5rem,1fr)_minmax(5rem,1fr)_minmax(5rem,1fr)_minmax(5rem,1fr)_3.5rem_4rem]";

function SummaryChip({
  label,
  value,
  accent = "text-term-text",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="panel flex min-w-[7rem] flex-col px-3 py-1.5">
      <span className="label text-[10px]">{label}</span>
      <span className={`tnum text-sm font-semibold ${accent}`}>{value}</span>
    </div>
  );
}

export function TradersPanel({
  traders,
  flow,
  now,
  onReset,
}: {
  traders: TraderStat[];
  flow: FlowStats;
  now: number;
  onReset?: () => void;
}) {
  const maxNtl = Math.max(traders[0]?.totalNtl ?? 0, 1e-9);
  const sessionVol = flow.totalNtl || 1e-9;

  return (
    <Panel
      title="TRADERS  ·  who is trading the pair"
      bodyClassName="flex flex-col"
      right={
        <span className="flex items-center gap-3">
          <span className="tnum text-term-muted">
            cumulative {flow.since ? `· ${ago(flow.since, now)}` : ""}
          </span>
          {onReset ? (
            <button
              onClick={onReset}
              className="border border-bg-line px-1.5 py-0.5 text-[10px] tracking-wider text-term-muted hover:border-term-red/50 hover:text-term-red"
            >
              RESET
            </button>
          ) : null}
        </span>
      }
    >
      {/* summary */}
      <div className="flex flex-wrap gap-2 border-b border-bg-line p-3">
        <SummaryChip label="UNIQUE TRADERS" value={num(flow.uniqueTraders, 0)} accent="text-term-green" />
        <SummaryChip label="ORGANIC" value={num(flow.uniqueOrganic, 0)} accent="text-term-green" />
        <SummaryChip label="OUR BOTS" value={num(flow.uniqueBots, 0)} accent="text-term-blue" />
        <SummaryChip label="SESSION TRADES" value={num(flow.totalTrades, 0)} />
        <SummaryChip label="SESSION VOLUME" value={usdSmart(flow.totalNtl)} />
        <SummaryChip label="AVG TRADE" value={usdSmart(flow.avgTradeNtl)} />
        <SummaryChip label="HTAO TRADED" value={num(flow.totalBaseVol, 2)} />
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className={`grid ${COLS} gap-x-2 border-b border-bg-line px-3 py-1.5 text-[10px] text-term-muted`}>
            <span>#</span>
            <span>ADDRESS</span>
            <span className="text-right">TXNS</span>
            <span className="text-right">BOUGHT</span>
            <span className="text-right">SOLD</span>
            <span className="text-right">NET</span>
            <span className="text-right">VOLUME</span>
            <span className="text-right">SHARE</span>
            <span className="text-right">LAST</span>
          </div>

          {traders.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-xs text-term-muted">
              waiting for trades…
            </div>
          ) : (
            traders.map((t, i) => {
              const w = Math.min(100, (t.totalNtl / maxNtl) * 100);
              const netUp = t.netNtl >= 0;
              const isBot = t.label !== "ORGANIC";
              return (
                <div
                  key={t.addr}
                  className={`relative grid ${COLS} items-center gap-x-2 border-b border-bg-line/40 px-3 py-1.5 text-xs`}
                >
                  <div
                    className={`absolute inset-y-0 left-0 ${isBot ? "bg-term-blue/[0.07]" : "bg-term-green/[0.06]"}`}
                    style={{ width: `${w}%` }}
                  />
                  <span className="tnum relative text-term-muted">{i + 1}</span>
                  <span className="relative truncate">
                    <AddrTag addr={t.addr} label={t.label} />
                  </span>
                  <span className="tnum relative text-right text-term-muted">
                    {num(t.trades, 0)}
                  </span>
                  <span className="tnum relative text-right text-term-green">
                    {usdSmart(t.buyNtl)}
                  </span>
                  <span className="tnum relative text-right text-term-red">
                    {usdSmart(t.sellNtl)}
                  </span>
                  <span
                    className={`tnum relative text-right ${netUp ? "text-term-green" : "text-term-red"}`}
                  >
                    {netUp ? "+" : "−"}
                    {usdSmart(Math.abs(t.netNtl))}
                  </span>
                  <span className="tnum relative text-right text-term-text">
                    {usdSmart(t.totalNtl)}
                  </span>
                  <span className="tnum relative text-right text-term-muted">
                    {pct((t.totalNtl / sessionVol) * 100, 1)}
                  </span>
                  <span className="tnum relative text-right text-term-muted">
                    {ago(t.lastSeen, now)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Panel>
  );
}
