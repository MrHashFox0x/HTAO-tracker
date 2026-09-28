"use client";

import type { FlowStats } from "@/lib/useHL";
import { usdSmart, share } from "@/lib/format";
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
  const deltaUp = flow.delta >= 0;

  const part = flow.mmNtl + flow.volBotNtl + flow.twapNtl + flow.organicNtl;
  // Order + colors validated as an adjacent set (aqua/blue/yellow/magenta).
  const series = [
    { name: "Organic", v: flow.organicNtl, bar: "bg-s3", dot: "bg-s3" },
    { name: "MM", v: flow.mmNtl, bar: "bg-s1", dot: "bg-s1" },
    { name: "TWAP", v: flow.twapNtl, bar: "bg-s2", dot: "bg-s2" },
    { name: "Vol bot", v: flow.volBotNtl, bar: "bg-s5", dot: "bg-s5" },
  ].map((s) => ({ ...s, p: part > 0 ? (s.v / part) * 100 : 0 }));

  return (
    <Panel
      title="Order flow"
      bodyClassName="flex flex-col"
      right={
        <span className={`tnum font-mono ${scope === "all-time" ? "text-accent" : ""}`}>
          {scope === "all-time" ? "all-time" : "session"} · {usdSmart(total)}
        </span>
      }
    >
      <div className="flex h-full flex-col px-4 pb-4 pt-3.5">
        {/* The answer: net delta */}
        <p
          className={`tnum font-mono text-3xl font-semibold leading-none ${deltaUp ? "text-buy" : "text-sell"}`}
        >
          {deltaUp ? "+" : "−"}
          {usdSmart(Math.abs(flow.delta))}
        </p>
        <p className="mt-1.5 text-[11px] text-ink-3">net delta (buy − sell)</p>

        {/* Pressure: one bar, values at the ends */}
        <div className="mt-4">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="bg-buy transition-[width] duration-500" style={{ width: `${buyShare}%` }} />
            <div className="bg-sell transition-[width] duration-500" style={{ width: `${100 - buyShare}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[11px]">
            <span className="tnum text-buy">
              Buy {usdSmart(flow.buyNtl)} · {share(buyShare, 1)}
            </span>
            <span className="tnum text-sell">
              {share(100 - buyShare, 1)} · {usdSmart(flow.sellNtl)} Sell
            </span>
          </div>
        </div>

        {/* Participation: who the flow is */}
        <div className="mt-auto rounded-lg border border-edge-soft bg-surface-2/40 p-3 pt-2.5">
          <p className="label mb-2">Participation</p>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
            {series.map((s) => (
              <div key={s.name} className={s.bar} style={{ width: `${s.p}%` }} title={s.name} />
            ))}
          </div>
          <div className="mt-2 space-y-px">
            {series.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between gap-3 rounded-md px-1.5 py-[5px] transition-colors hover:bg-surface-2/70"
              >
                <span className="flex items-center gap-2 text-xs text-ink-2">
                  <span className={`h-2 w-2 rounded-[2px] ${s.dot}`} />
                  {s.name}
                </span>
                <span className="tnum font-mono text-xs">
                  <span className="font-semibold text-ink">{share(s.p, 1)}</span>
                  <span className="text-ink-3"> · {usdSmart(s.v)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
