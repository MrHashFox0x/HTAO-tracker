"use client";

import type { UiTrade } from "@/lib/hl";
import { labelFor } from "@/lib/hl";
import { price, num, usdSmart, timeHMS } from "@/lib/format";
import { Panel } from "./Panel";
import { AddrTag } from "./AddrTag";

/**
 * Show the taker (aggressor) side — that's who initiated the trade.
 * Label derived from the address at render time (not the stored label), so
 * newly-known addresses tag the whole tape instantly, old rows included.
 */
function taker(t: UiTrade) {
  const addr = t.side === "B" ? t.buyer : t.seller;
  return { addr, label: labelFor(addr) };
}

export function TradeTape({ trades }: { trades: UiTrade[] }) {
  return (
    <Panel
      title="Trade tape"
      className="h-[440px]"
      bodyClassName="overflow-hidden flex flex-col"
      right={<span className="tnum font-mono">{trades.length} live</span>}
    >
      <div className="grid grid-cols-[4.5rem_1fr_1fr_1fr_9.5rem] gap-x-2 border-b border-edge-soft px-4 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-3">
        <span>Time</span>
        <span className="text-right">Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Notional</span>
        <span className="text-right">Taker</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-3">
            waiting for trades…
          </div>
        ) : (
          trades.map((t) => {
            const tk = taker(t);
            const buy = t.side === "B";
            return (
              <div
                key={t.tid}
                className={`grid grid-cols-[4.5rem_1fr_1fr_1fr_9.5rem] items-center gap-x-2 border-b border-edge-soft/70 px-4 py-1 font-mono text-xs leading-tight hover:bg-surface-2/60 ${
                  buy ? "animate-flash" : "animate-flash-red"
                }`}
              >
                <span className="tnum text-[11px] text-ink-3">{timeHMS(t.time)}</span>
                <span className={`tnum text-right font-semibold ${buy ? "text-buy" : "text-sell"}`}>
                  {price(t.px)}
                </span>
                <span className="tnum text-right text-ink">{num(t.sz, 2)}</span>
                <span className="tnum text-right text-ink-2">{usdSmart(t.notional)}</span>
                <span className="flex items-center justify-end text-right">
                  <AddrTag addr={tk.addr} label={tk.label} link={false} />
                </span>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
