"use client";

import { useEffect, useRef, useState } from "react";
import type { FlowStats, TraderStat } from "./useHL";
import type { UiTrade } from "./hl";

// ---------------------------------------------------------------------------
// useAllTime — polls the server-side all-time store (/api/stats/*), which is
// fed 24/7 by the standalone collector. Returns null/empty until the DB is
// configured AND ready (collector has written at least once); the page then
// falls back to the live WS/localStorage session view, so the dashboard works
// with or without the backend.
// ---------------------------------------------------------------------------

export interface AllTimeState {
  configured: boolean; // DATABASE_URL set on the server
  ready: boolean; // collector has populated the table
  flow: FlowStats | null;
  traders: TraderStat[];
  trades: UiTrade[];
  updatedAt: number | null;
}

const EMPTY: AllTimeState = {
  configured: false,
  ready: false,
  flow: null,
  traders: [],
  trades: [],
  updatedAt: null,
};

export function useAllTime(pollMs = 10_000, traderLimit = 100): AllTimeState {
  const [state, setState] = useState<AllTimeState>(EMPTY);
  // Once we learn the DB isn't configured, stop polling entirely.
  const giveUp = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const [ovRes, trRes] = await Promise.all([
          fetch(`/api/stats/overview?limit=${traderLimit}`, { cache: "no-store" }),
          fetch(`/api/stats/trades?limit=300`, { cache: "no-store" }),
        ]);
        const ov = await ovRes.json();
        const tr = await trRes.json().catch(() => ({ trades: [] }));
        if (!alive) return;

        if (!ov?.configured) {
          giveUp.current = true;
          setState((s) => ({ ...s, configured: false, ready: false }));
          return; // no backend — don't reschedule
        }
        setState({
          configured: true,
          ready: !!ov.ready,
          flow: ov.ready ? (ov.flow as FlowStats) : null,
          traders: ov.ready ? (ov.traders as TraderStat[]) : [],
          trades: tr?.ready ? (tr.trades as UiTrade[]) : [],
          updatedAt: ov.ready ? (ov.generatedAt ?? Date.now()) : null,
        });
      } catch {
        /* transient — keep last good state, retry on next tick */
      }
      if (alive && !giveUp.current) timer = setTimeout(tick, pollMs);
    };

    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [pollMs, traderLimit]);

  return state;
}

/** Merge live WS tape (freshest) with DB scrollback, dedup by tid, newest first. */
export function mergeTapes(live: UiTrade[], db: UiTrade[], cap = 600): UiTrade[] {
  if (db.length === 0) return live;
  const seen = new Set<number>();
  const out: UiTrade[] = [];
  for (const t of [...live, ...db]) {
    if (seen.has(t.tid)) continue;
    seen.add(t.tid);
    out.push(t);
  }
  out.sort((a, b) => b.time - a.time);
  return out.slice(0, cap);
}
