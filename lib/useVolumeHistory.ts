"use client";

import { useEffect, useState } from "react";
import { fetchCandles } from "./useHL";
import type { Candle } from "./hl";

// ---------------------------------------------------------------------------
// useVolumeHistory — full-life daily volume series for the pair, merged from
// two sources:
//
//   1. HL 1d candles: cover every day since the pair listed, but only carry
//      base volume (v, HTAO). USDC notional is estimated as v × (o+h+l+c)/4,
//      a daily-vwap proxy — good to well under 1% on a pair this tight.
//   2. The collector DB (/api/stats/volume): exact per-trade notional, but
//      only since the collector started.
//
// A DB day replaces the candle estimate only when it's provably complete:
// the day starts on/after the first full UTC day of collection AND its trade
// count matches the candle's trade count (a collector outage would otherwise
// silently understate that day).
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
// Way past HTAO's listing date; HL just returns candles from inception.
const LOOKBACK_DAYS = 2000;

export interface VolumeDay {
  t: number; // UTC day open, ms
  ntl: number; // USDC volume for the day (exact or estimated)
  base: number; // HTAO volume for the day (always exact)
  trades: number;
  cumNtl: number;
  cumBase: number;
  exact: boolean; // notional comes from the DB, not the vwap estimate
}

export interface VolumeHistoryState {
  days: VolumeDay[];
  loading: boolean;
  error: boolean;
  /** First day whose notional is exact (DB-backed); null if none are. */
  exactSince: number | null;
}

interface DbDaily {
  since: number | null;
  days: { t: number; ntl: number; base: number; trades: number }[];
}

async function fetchDbDaily(): Promise<DbDaily | null> {
  const r = await fetch("/api/stats/volume", { cache: "no-store" });
  const j = await r.json();
  if (!j?.configured || !j?.ready || !Array.isArray(j.days)) return null;
  return { since: j.since ?? null, days: j.days };
}

function merge(candles: Candle[], db: DbDaily | null): VolumeDay[] {
  const dbByDay = new Map((db?.days ?? []).map((d) => [d.t, d]));
  // First UTC day fully covered by collection (the day it started is partial).
  const firstFullDay = db?.since != null ? Math.ceil(db.since / DAY_MS) * DAY_MS : Infinity;

  // No candle history (HL down): fall back to DB-only, all days exact.
  const source =
    candles.length > 0
      ? [...candles]
          .sort((a, b) => a.t - b.t)
          .map((c) => {
            const base = +c.v;
            const vwapEst = base * ((+c.o + +c.h + +c.l + +c.c) / 4);
            const row = dbByDay.get(c.t);
            // 2% slack: WS-collected counts and candle n can differ by a hair
            // at day boundaries without the day actually being incomplete.
            const exact = !!row && c.t >= firstFullDay && row.trades >= (c.n || 0) * 0.98;
            return exact
              ? { t: c.t, ntl: row!.ntl, base: row!.base, trades: row!.trades, exact: true }
              : { t: c.t, ntl: vwapEst, base, trades: c.n || 0, exact: false };
          })
      : (db?.days ?? []).map((d) => ({ ...d, exact: true }));

  let cumNtl = 0;
  let cumBase = 0;
  return source.map((d) => {
    cumNtl += d.ntl;
    cumBase += d.base;
    return { ...d, cumNtl, cumBase };
  });
}

export function useVolumeHistory(pollMs = 60_000): VolumeHistoryState {
  const [state, setState] = useState<VolumeHistoryState>({
    days: [],
    loading: true,
    error: false,
    exactSince: null,
  });
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const [candles, db] = await Promise.all([
        fetchCandles("1d", LOOKBACK_DAYS).catch(() => [] as Candle[]),
        fetchDbDaily().catch(() => null),
      ]);
      if (!alive) return;

      const days = merge(candles, db);
      setState({
        days,
        loading: false,
        error: days.length === 0,
        exactSince: days.find((d) => d.exact)?.t ?? null,
      });
      timer = setTimeout(tick, pollMs);
    };

    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [pollMs]);

  return state;
}
