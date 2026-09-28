"use client";

import type { L2Book } from "@/lib/hl";
import { price, num } from "@/lib/format";
import { Panel } from "./Panel";

const DEPTH = 12;

interface Row {
  px: number;
  sz: number;
  n: number;
  cum: number;
}

function build(levels: { px: string; sz: string; n: number }[] | undefined): Row[] {
  if (!levels) return [];
  let cum = 0;
  return levels.slice(0, DEPTH).map((l) => {
    cum += +l.sz;
    return { px: +l.px, sz: +l.sz, n: l.n, cum };
  });
}

export function OrderBook({ book }: { book: L2Book | null }) {
  const bids = build(book?.levels?.[0]);
  const asks = build(book?.levels?.[1]);

  const bestBid = bids[0]?.px ?? null;
  const bestAsk = asks[0]?.px ?? null;
  const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null;
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
  const spreadBps = spread != null && mid ? (spread / mid) * 10000 : null;

  const maxCum = Math.max(
    bids[bids.length - 1]?.cum ?? 0,
    asks[asks.length - 1]?.cum ?? 0,
    1e-9,
  );

  return (
    <Panel
      title="Order book"
      className="h-[520px]"
      bodyClassName="flex flex-col overflow-hidden"
      right={
        spreadBps != null ? (
          <span className="tnum font-mono">
            spread <span className="font-semibold text-ink">{num(spreadBps, 1)} bps</span>
          </span>
        ) : null
      }
    >
      <div className="grid grid-cols-[1fr_1fr_auto] gap-x-2 px-4 pt-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-3">
        <span>Price</span>
        <span className="text-right">Size (HTAO)</span>
        <span className="text-right">Cum</span>
      </div>

      {/* asks: worst at top, best ask just above the mid */}
      <div className="flex flex-1 flex-col justify-end px-4">
        {[...asks].reverse().map((r) => (
          <BookRow key={`a${r.px}`} r={r} maxCum={maxCum} side="ask" />
        ))}
      </div>

      <div className="mx-4 my-1.5 flex items-center gap-3">
        <span className="tnum font-mono text-[11px] text-ink-2 whitespace-nowrap">
          mid <span className="text-sm font-semibold text-ink">{price(mid)}</span>
        </span>
        <div className="flex-1 border-t border-dashed border-edge-strong" />
        <span className="tnum font-mono text-[11px] text-ink-3 whitespace-nowrap">
          {spread != null ? price(spread) : "—"}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-2.5">
        {bids.map((r) => (
          <BookRow key={`b${r.px}`} r={r} maxCum={maxCum} side="bid" />
        ))}
      </div>
    </Panel>
  );
}

function BookRow({ r, maxCum, side }: { r: Row; maxCum: number; side: "bid" | "ask" }) {
  const pctw = Math.min(100, (r.cum / maxCum) * 100);
  const isBid = side === "bid";
  return (
    <div className="relative grid grid-cols-[1fr_1fr_auto] gap-x-2 rounded-[3px] py-[1px] font-mono text-xs leading-tight">
      <div
        className={`absolute inset-y-0 left-0 rounded-[3px] ${isBid ? "bg-buy/10" : "bg-sell/10"}`}
        style={{ width: `${pctw}%` }}
      />
      <span className={`tnum relative ${isBid ? "text-buy" : "text-sell"}`}>{price(r.px)}</span>
      <span className="tnum relative text-right text-ink">{num(r.sz, 2)}</span>
      <span className="tnum relative text-right text-ink-3">{num(r.cum, 1)}</span>
    </div>
  );
}
