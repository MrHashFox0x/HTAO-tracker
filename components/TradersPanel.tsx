"use client";

import type { TraderStat, FlowStats } from "@/lib/useHL";
import { labelFor } from "@/lib/hl";
import { usdSmart, num, share, ago } from "@/lib/format";
import { Panel } from "./Panel";
import { AddrTag } from "./AddrTag";

const COLS =
  "grid-cols-[2.25rem_minmax(8rem,1fr)_3.5rem_minmax(5rem,1fr)_minmax(5rem,1fr)_minmax(5rem,1fr)_minmax(5rem,1fr)_3.5rem_4rem]";

function SummaryChip({
  label,
  value,
  accent = "text-ink",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex min-w-[7rem] flex-col rounded-lg border border-edge-soft bg-surface-2/40 px-3 py-2">
      <span className="label">{label}</span>
      <span className={`tnum font-mono text-sm font-semibold ${accent}`}>{value}</span>
    </div>
  );
}

export function TradersPanel({
  traders,
  flow,
  now,
  scope = "session",
  dbConfigured = false,
  allTime = false,
  onToggleScope,
  onReset,
}: {
  traders: TraderStat[];
  flow: FlowStats;
  now: number;
  scope?: "all-time" | "session";
  dbConfigured?: boolean;
  allTime?: boolean;
  onToggleScope?: () => void;
  onReset?: () => void;
}) {
  const maxNtl = Math.max(traders[0]?.totalNtl ?? 0, 1e-9);
  const sessionVol = flow.totalNtl || 1e-9;
  const isAllTime = scope === "all-time";

  return (
    <Panel
      title="Traders"
      className="max-h-[560px]"
      bodyClassName="flex flex-col overflow-hidden"
      right={
        <span className="flex items-center gap-3">
          <span className={`tnum font-mono ${isAllTime ? "text-accent" : ""}`}>
            {isAllTime ? "all-time" : "session"} {flow.since ? `· since ${ago(flow.since, now)}` : ""}
          </span>
          {dbConfigured && onToggleScope ? (
            <button
              onClick={onToggleScope}
              className="rounded-[5px] border border-edge bg-surface-2 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-2 transition-colors hover:bg-surface-3"
              title={allTime ? "Show this browser's live session" : "Show all-time (collector DB)"}
            >
              {allTime ? "View: all-time" : "View: session"}
            </button>
          ) : null}
          {onReset ? (
            <button
              onClick={onReset}
              className="rounded-[5px] border border-sell/25 bg-sell-dim px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-sell transition-colors hover:bg-sell/20"
            >
              Reset
            </button>
          ) : null}
        </span>
      }
    >
      {/* summary */}
      <div className="flex flex-wrap gap-2 border-b border-edge-soft p-4">
        <SummaryChip label="Unique traders" value={num(flow.uniqueTraders, 0)} accent="text-accent" />
        <SummaryChip label="Organic" value={num(flow.uniqueOrganic, 0)} accent="text-buy" />
        <SummaryChip label="Our bots" value={num(flow.uniqueBots, 0)} accent="text-s1" />
      </div>

      {/* table — scrolls inside the panel, header stays pinned */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[760px]">
          <div
            className={`sticky top-0 z-10 grid ${COLS} gap-x-2 border-b border-edge-soft bg-surface px-4 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-3`}
          >
            <span>#</span>
            <span>Address</span>
            <span className="text-right">Txns</span>
            <span className="text-right">Bought</span>
            <span className="text-right">Sold</span>
            <span className="text-right">Net</span>
            <span className="text-right">Volume</span>
            <span className="text-right">Share</span>
            <span className="text-right">Last</span>
          </div>

          {traders.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-xs text-ink-3">
              waiting for trades…
            </div>
          ) : (
            traders.map((t, i) => {
              const w = Math.min(100, (t.totalNtl / maxNtl) * 100);
              const netUp = t.netNtl >= 0;
              // Derived at render so newly-known addresses retag instantly.
              const label = labelFor(t.addr);
              const isBot = label !== "ORGANIC";
              return (
                <div
                  key={t.addr}
                  className={`relative grid ${COLS} items-center gap-x-2 border-b border-edge-soft/70 px-4 py-1.5 font-mono text-xs hover:bg-surface-2/60`}
                >
                  <div
                    className={`absolute inset-y-0 left-0 ${isBot ? "bg-s1/[0.06]" : "bg-s3/[0.06]"}`}
                    style={{ width: `${w}%` }}
                  />
                  <span className="tnum relative text-ink-3">{i + 1}</span>
                  <span className="relative truncate">
                    <AddrTag addr={t.addr} label={label} />
                  </span>
                  <span className="tnum relative text-right text-ink-3">{num(t.trades, 0)}</span>
                  <span className="tnum relative text-right text-buy">{usdSmart(t.buyNtl)}</span>
                  <span className="tnum relative text-right text-sell">{usdSmart(t.sellNtl)}</span>
                  <span className={`tnum relative text-right ${netUp ? "text-buy" : "text-sell"}`}>
                    {netUp ? "+" : "−"}
                    {usdSmart(Math.abs(t.netNtl))}
                  </span>
                  <span className="tnum relative text-right font-semibold text-ink">
                    {usdSmart(t.totalNtl)}
                  </span>
                  <span className="tnum relative text-right text-ink-3">
                    {share((t.totalNtl / sessionVol) * 100, 1)}
                  </span>
                  <span className="tnum relative text-right text-ink-3">{ago(t.lastSeen, now)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Panel>
  );
}
