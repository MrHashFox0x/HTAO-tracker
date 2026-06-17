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
      title="ORDER BOOK"
      className="h-[520px]"
      bodyClassName="flex flex-col overflow-hidden"
      right={
        spreadBps != null ? (
          <span className="tnum">
            SPREAD <span className="text-term-amber">{num(spreadBps, 1)} bps</span>
          </span>
        ) : null
      }
    >
      <div className="grid grid-cols-[1fr_1fr_auto] gap-x-2 px-3 pt-2 text-[10px] text-term-muted">
        <span>PRICE</span>
        <span className="text-right">SIZE (HTAO)</span>
        <span className="text-right">CUM</span>
      </div>

      {/* asks: worst at top, best ask just above the mid */}
      <div className="flex flex-1 flex-col justify-end px-3">
        {[...asks].reverse().map((r) => (
          <BookRow key={`a${r.px}`} r={r} maxCum={maxCum} side="ask" />
        ))}
      </div>

      <div className="my-1 flex items-center justify-between border-y border-bg-line bg-bg-raised/60 px-3 py-1.5">
        <span className="tnum text-sm font-bold text-term-bright">{price(mid)}</span>
        <span className="label">MID</span>
        <span className="tnum text-xs text-term-muted">
          {spread != null ? price(spread) : "—"}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-2">
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
    <div className="relative grid grid-cols-[1fr_1fr_auto] gap-x-2 py-[1px] text-xs leading-tight">
      <div
        className={`absolute inset-y-0 ${isBid ? "left-0 bg-term-green/10" : "left-0 bg-term-red/10"}`}
        style={{ width: `${pctw}%` }}
      />
      <span className={`tnum relative ${isBid ? "text-term-green" : "text-term-red"}`}>
        {price(r.px)}
      </span>
      <span className="tnum relative text-right text-term-text">{num(r.sz, 2)}</span>
      <span className="tnum relative text-right text-term-muted">{num(r.cum, 1)}</span>
    </div>
  );
}
