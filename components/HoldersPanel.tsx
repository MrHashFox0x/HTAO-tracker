"use client";

import { useEffect, useState } from "react";
import type { Overview } from "@/lib/hl";
import { labelFor } from "@/lib/hl";
import { num, usdSmart, share } from "@/lib/format";
import { Panel } from "./Panel";
import { AddrTag } from "./AddrTag";

interface Holder {
  addr: string;
  balance: number;
}

interface HoldersSnapshot {
  lastUpdate: number | null;
  totalHeld: number;
  systemBalance: number;
  holders: Holder[];
}

function toCsv(holders: Holder[], totalHeld: number, mid: number | null): string {
  const header = "rank,address,label,balance_htao,share_pct,value_usdc";
  const rows = holders.map((h, i) =>
    [
      i + 1,
      h.addr,
      labelFor(h.addr),
      h.balance,
      totalHeld > 0 ? ((h.balance / totalHeld) * 100).toFixed(4) : "",
      mid != null ? (h.balance * mid).toFixed(2) : "",
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

export function HoldersPanel({ ov }: { ov: Overview | null }) {
  const [snap, setSnap] = useState<HoldersSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/hl/holders", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const data = (await r.json()) as HoldersSnapshot;
        if (!cancelled && Array.isArray(data.holders)) {
          setSnap(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const mid = ov?.mid ?? ov?.mark ?? null;
  const holders = snap?.holders ?? [];
  const totalHeld = snap?.totalHeld ?? 0;
  const maxBal = holders[0]?.balance ?? 1e-9;

  const exportCsv = () => {
    if (!snap) return;
    const blob = new Blob([toCsv(holders, totalHeld, mid)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `htao-holders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel
      title="Holders"
      className="h-[440px]"
      bodyClassName="flex flex-col overflow-hidden"
      right={
        <span className="flex items-center gap-3">
          {snap ? (
            <span className="flex items-baseline gap-1.5" title="system/bridge address excluded">
              <span className="tnum font-mono text-lg font-semibold leading-none text-accent">
                {num(holders.length, 0)}
              </span>
              <span className="text-[11px] text-ink-2">wallets</span>
            </span>
          ) : null}
          <button
            onClick={exportCsv}
            disabled={!snap}
            className="rounded-[5px] border border-edge bg-surface-2 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-2 transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
            title="Download the full holder list as CSV"
          >
            Export CSV
          </button>
        </span>
      }
    >
      <div className="grid grid-cols-[2.5rem_minmax(9rem,1fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_4rem] gap-x-2 border-b border-edge-soft px-4 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-3">
        <span>#</span>
        <span>Address</span>
        <span className="text-right">Balance (HTAO)</span>
        <span className="text-right">Value</span>
        <span className="text-right">Share</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && !snap ? (
          <div className="flex h-full items-center justify-center text-xs text-warn">
            holders unavailable — retrying…
          </div>
        ) : !snap ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-3">
            loading holders…
          </div>
        ) : (
          holders.map((h, i) => {
            const w = Math.min(100, (h.balance / maxBal) * 100);
            const label = labelFor(h.addr);
            const isBot = label !== "ORGANIC";
            return (
              <div
                key={h.addr}
                className="relative grid grid-cols-[2.5rem_minmax(9rem,1fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_4rem] items-center gap-x-2 border-b border-edge-soft/70 px-4 py-1.5 font-mono text-xs hover:bg-surface-2/60"
              >
                <div
                  className={`absolute inset-y-0 left-0 ${isBot ? "bg-s1/[0.06]" : "bg-s3/[0.06]"}`}
                  style={{ width: `${w}%` }}
                />
                <span className="tnum relative text-ink-3">{i + 1}</span>
                <span className="relative truncate">
                  <AddrTag addr={h.addr} label={label} />
                </span>
                <span className="tnum relative text-right text-ink">{num(h.balance, 2)}</span>
                <span className="tnum relative text-right text-ink-2">
                  {mid != null ? usdSmart(h.balance * mid) : "—"}
                </span>
                <span className="tnum relative text-right text-ink-3">
                  {totalHeld > 0 ? share((h.balance / totalHeld) * 100, 1) : "—"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
