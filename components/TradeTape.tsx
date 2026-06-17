"use client";

import type { UiTrade } from "@/lib/hl";
import { price, num, usdSmart, timeHMS } from "@/lib/format";
import { Panel } from "./Panel";
import { AddrTag } from "./AddrTag";

/** Show the taker (aggressor) side — that's who initiated the trade. */
function taker(t: UiTrade) {
  return t.side === "B"
    ? { addr: t.buyer, label: t.buyerLabel }
    : { addr: t.seller, label: t.sellerLabel };
}

export function TradeTape({ trades }: { trades: UiTrade[] }) {
  return (
    <Panel
      title="TRADE TAPE"
      className="h-[440px]"
      bodyClassName="overflow-hidden flex flex-col"
      right={<span className="tnum">{trades.length} live</span>}
    >
      <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-2 border-b border-bg-line px-3 py-1.5 text-[10px] text-term-muted">
        <span>TIME</span>
        <span className="text-right">PRICE</span>
        <span className="text-right">SIZE</span>
        <span className="text-right">NOTIONAL</span>
        <span className="text-right">TAKER</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-term-muted">
            waiting for trades…
          </div>
        ) : (
          trades.map((t) => {
            const tk = taker(t);
            const buy = t.side === "B";
            return (
              <div
                key={t.tid}
                className={`grid grid-cols-[auto_1fr_1fr_1fr_auto] items-center gap-x-2 border-b border-bg-line/30 px-3 py-1 text-xs leading-tight ${
                  buy ? "animate-flash" : "animate-flash-red"
                }`}
              >
                <span className="tnum text-term-muted">{timeHMS(t.time)}</span>
                <span className={`tnum text-right font-semibold ${buy ? "text-term-green" : "text-term-red"}`}>
                  {price(t.px)}
                </span>
                <span className="tnum text-right text-term-text">{num(t.sz, 2)}</span>
                <span className="tnum text-right text-term-text">{usdSmart(t.notional)}</span>
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
