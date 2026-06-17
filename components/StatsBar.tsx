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
  accent = "text-term-text",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="panel flex flex-col justify-between px-3 py-2">
      <span className="label">{label}</span>
      <span className={`tnum mt-1 text-base font-semibold ${accent}`}>{value}</span>
      {sub ? <span className="tnum text-[10px] text-term-muted">{sub}</span> : null}
    </div>
  );
}

export function StatsBar({ ov, daily }: { ov: Overview | null; daily: DailyDerived }) {
  return (
    <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-6">
      <Stat
        label="24H VOLUME (USDC)"
        value={usdSmart(ov?.dayNtlVlm ?? null)}
        accent="text-term-green"
      />
      <Stat label="24H VOLUME (HTAO)" value={`${num(ov?.dayBaseVlm ?? null, 2)}`} sub="HTAO" />
      <Stat label="24H TRADES" value={daily.trades != null ? num(daily.trades, 0) : "—"} />
      <Stat label="24H HIGH" value={price(daily.high)} accent="text-term-green" />
      <Stat label="24H LOW" value={price(daily.low)} accent="text-term-red" />
      <Stat
        label="MARKET CAP"
        value={usdCompact(ov?.marketCap ?? null)}
        sub={`FDV ${usdCompact(ov?.fdv ?? null)}`}
      />
    </div>
  );
}
