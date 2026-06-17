"use client";

import { PAIR_NAME } from "@/lib/hl";
import type { Overview } from "@/lib/hl";
import type { WsStatus } from "@/lib/useHL";
import { price, pct, signed, utcClock } from "@/lib/format";

const STATUS_MAP: Record<WsStatus, { txt: string; cls: string; dot: string }> = {
  live: { txt: "LIVE", cls: "text-term-green", dot: "bg-term-green animate-blink" },
  connecting: { txt: "CONNECTING", cls: "text-term-amber", dot: "bg-term-amber animate-blink" },
  reconnecting: { txt: "RECONNECTING", cls: "text-term-amber", dot: "bg-term-amber animate-blink" },
  down: { txt: "OFFLINE", cls: "text-term-red", dot: "bg-term-red" },
};

export function Header({
  ov,
  status,
  now,
}: {
  ov: Overview | null;
  status: WsStatus;
  now: number;
}) {
  const ref = ov?.mid ?? ov?.mark ?? null;
  const up = (ov?.changePct24h ?? 0) >= 0;
  const st = STATUS_MAP[status];

  return (
    <header className="panel corner mb-2 flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3">
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-bold tracking-widest text-term-bright drop-shadow-[0_0_8px_rgba(34,229,143,0.5)]">
          {PAIR_NAME}
        </span>
        <span className="label">HYPERLIQUID · SPOT · @307</span>
      </div>

      <div className="flex items-end gap-3">
        <span
          className={`tnum text-3xl font-bold leading-none ${up ? "text-term-green" : "text-term-red"}`}
        >
          {price(ref)}
        </span>
        <div className="flex flex-col leading-tight">
          <span className={`tnum text-sm ${up ? "text-term-green" : "text-term-red"}`}>
            {signed(ov?.change24h ?? null)} ({pct(ov?.changePct24h ?? null)})
          </span>
          <span className="label">24H</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-6">
        <Field label="MARK" value={price(ov?.mark ?? null)} />
        <Field label="PREV CLOSE" value={price(ov?.prevDayPx ?? null)} />
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${st.dot}`} />
          <span className={`text-xs font-bold tracking-widest ${st.cls}`}>{st.txt}</span>
        </div>
        <span className="tnum hidden text-xs text-term-muted md:inline">{utcClock(now)}</span>
      </div>
    </header>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden flex-col items-end leading-tight sm:flex">
      <span className="tnum text-sm text-term-text">{value}</span>
      <span className="label">{label}</span>
    </div>
  );
}
