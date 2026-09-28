"use client";

import { PAIR_NAME } from "@/lib/hl";
import type { Overview } from "@/lib/hl";
import type { WsStatus } from "@/lib/useHL";
import { price, pct, signed } from "@/lib/format";

/** Shown only when the feed is degraded — silence means live.  */
const DEGRADED: Partial<Record<WsStatus, { txt: string; cls: string; dot: string }>> = {
  connecting: { txt: "CONNECTING", cls: "text-warn", dot: "bg-warn animate-blink" },
  reconnecting: { txt: "RECONNECTING", cls: "text-warn", dot: "bg-warn animate-blink" },
  down: { txt: "OFFLINE", cls: "text-sell", dot: "bg-sell" },
};

/** Sticky header over the dark green body. */
export function Header({ ov, status }: { ov: Overview | null; status: WsStatus }) {
  const ref = ov?.mid ?? ov?.mark ?? null;
  const up = (ov?.changePct24h ?? 0) >= 0;
  const st = DEGRADED[status];

  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        {/* Identity */}
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hyperliquid.png"
            alt="Hyperliquid"
            className="h-9 w-9 shrink-0 rounded-lg shadow-sm"
          />
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[15px] font-semibold text-ink">
              Dashboard MentatMinds <span className="text-accent">{PAIR_NAME}</span>
            </h1>
          </div>
        </div>

        {/* Hero price + 24h change */}
        <div className="ml-auto flex items-baseline gap-3">
          <span
            className={`tnum font-mono text-2xl font-semibold leading-none ${up ? "text-buy" : "text-sell"}`}
          >
            {price(ref)}
          </span>
          <span className={`tnum font-mono text-xs font-medium ${up ? "text-buy" : "text-sell"}`}>
            {signed(ov?.change24h ?? null)} ({pct(ov?.changePct24h ?? null)})
          </span>
        </div>

        {st ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium">
            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
            <span className={st.cls}>{st.txt}</span>
          </span>
        ) : null}
      </div>
    </header>
  );
}
