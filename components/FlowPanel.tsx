"use client";

import type { FlowStats } from "@/lib/useHL";
import { usdSmart, pct, num } from "@/lib/format";
import { Panel } from "./Panel";

export function FlowPanel({
  flow,
  scope = "session",
}: {
  flow: FlowStats;
  scope?: "all-time" | "session";
}) {
  const total = flow.buyNtl + flow.sellNtl;
  const buyShare = total > 0 ? (flow.buyNtl / total) * 100 : 50;

  const part = flow.mmNtl + flow.volBotNtl + flow.organicNtl;
  const mmPct = part > 0 ? (flow.mmNtl / part) * 100 : 0;
  const volPct = part > 0 ? (flow.volBotNtl / part) * 100 : 0;
  const orgPct = part > 0 ? (flow.organicNtl / part) * 100 : 0;
  const deltaUp = flow.delta >= 0;

  return (
    <Panel
      title="ORDER FLOW"
      right={
        <span className={`tnum ${scope === "all-time" ? "text-term-green" : "text-term-muted"}`}>
          {scope === "all-time" ? "ALL-TIME" : "CUMULATIVE"}
        </span>
      }
    >
      <div className="flex h-full flex-col gap-3 p-3">
        {/* buy vs sell pressure */}
        <div>
          <div className="mb-1 flex justify-between text-xs font-semibold">
            <span className="text-term-green">BUY {pct(buyShare, 1)}</span>
            <span className="label">PRESSURE</span>
            <span className="text-term-red">{pct(100 - buyShare, 1)} SELL</span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-sm bg-bg-raised">
            <div className="bg-term-green" style={{ width: `${buyShare}%` }} />
            <div className="bg-term-red" style={{ width: `${100 - buyShare}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px]">
            <span className="tnum text-term-green">{usdSmart(flow.buyNtl)}</span>
            <span className="tnum text-term-red">{usdSmart(flow.sellNtl)}</span>
          </div>
        </div>

        {/* cumulative delta */}
        <div className="panel flex items-center justify-between px-3 py-2">
          <span className="label">CUM. DELTA (BUY − SELL)</span>
          <span className={`tnum text-lg font-bold ${deltaUp ? "text-term-green" : "text-term-red"}`}>
            {deltaUp ? "+" : "−"}
            {usdSmart(Math.abs(flow.delta))}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Mini label="BUY TRADES" value={num(flow.buyTrades, 0)} accent="text-term-green" />
          <Mini label="SELL TRADES" value={num(flow.sellTrades, 0)} accent="text-term-red" />
        </div>

        {/* participation: MM / VOL BOT / ORGANIC */}
        <div className="mt-auto">
          <div className="mb-1 flex items-center justify-between">
            <span className="label">PARTICIPATION</span>
            <span className="tnum text-[11px] text-term-muted">
              {scope === "all-time" ? "all-time" : "session"} {usdSmart(part)}
            </span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-sm bg-bg-raised">
            <div className="bg-term-blue" style={{ width: `${mmPct}%` }} title="MM" />
            <div className="bg-term-violet" style={{ width: `${volPct}%` }} title="Volume bot" />
            <div className="bg-term-green" style={{ width: `${orgPct}%` }} title="Organic" />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <Legend dot="bg-term-blue" name="MM" p={mmPct} v={flow.mmNtl} text="text-term-blue" />
            <Legend
              dot="bg-term-violet"
              name="VOL BOT"
              p={volPct}
              v={flow.volBotNtl}
              text="text-term-violet"
            />
            <Legend
              dot="bg-term-green"
              name="ORGANIC"
              p={orgPct}
              v={flow.organicNtl}
              text="text-term-green"
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="panel flex flex-col px-3 py-2">
      <span className="label">{label}</span>
      <span className={`tnum text-base font-semibold ${accent}`}>{value}</span>
    </div>
  );
}

function Legend({
  dot,
  name,
  p,
  v,
  text,
}: {
  dot: string;
  name: string;
  p: number;
  v: number;
  text: string;
}) {
  return (
    <div className="panel flex flex-col gap-0.5 px-2 py-1.5">
      <span className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="label text-[10px]">{name}</span>
      </span>
      <span className={`tnum font-bold ${text}`}>{pct(p, 1)}</span>
      <span className="tnum text-[10px] text-term-muted">{usdSmart(v)}</span>
    </div>
  );
}
