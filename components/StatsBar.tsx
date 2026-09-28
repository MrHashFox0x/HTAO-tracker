"use client";

import type { Overview } from "@/lib/hl";
import { usdCompact, usdSmart, price, num } from "@/lib/format";

export interface DailyDerived {
  high: number | null;
  low: number | null;
  trades: number | null;
}

function Stat({
  label,
  value,
  sub,
  accent = "text-ink",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-edge bg-surface px-3.5 py-2.5 shadow-card">
      <span className="label">{label}</span>
      <span className={`tnum mt-1 font-mono text-base font-semibold leading-tight ${accent}`}>
        {value}
      </span>
      {sub ? <span className="tnum font-mono text-[10px] text-ink-3">{sub}</span> : null}
    </div>
  );
}

export function StatsBar({ ov, daily }: { ov: Overview | null; daily: DailyDerived }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <Stat label="24h volume (USDC)" value={usdSmart(ov?.dayNtlVlm ?? null)} accent="text-accent" />
      <Stat label="24h volume (HTAO)" value={num(ov?.dayBaseVlm ?? null, 2)} sub="HTAO" />
      <Stat label="24h trades" value={daily.trades != null ? num(daily.trades, 0) : "—"} />
      <Stat label="24h high" value={price(daily.high)} accent="text-buy" />
      <Stat label="24h low" value={price(daily.low)} accent="text-sell" />
      <Stat
        label="Market cap"
        value={usdCompact(ov?.marketCap ?? null)}
        sub={`FDV ${usdCompact(ov?.fdv ?? null)}`}
      />
    </div>
  );
}
