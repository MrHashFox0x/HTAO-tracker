"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HL_WS_URL,
  PAIR_COIN,
  PAIR_NAME,
  BASE_TOKEN,
  QUOTE_TOKEN,
  HTAO_SZ_DECIMALS,
  HTAO_WEI_DECIMALS,
  HTAO_TOKEN_ID,
  HTAO_EVM_CONTRACT,
  labelFor,
  type Overview,
  type Candle,
  type L2Book,
  type Trade,
  type UiTrade,
  type BboLevel,
  type TraderLabel,
} from "./hl";

// ---------------------------------------------------------------------------
// Candle history — single REST snapshot per interval (WS only streams forward,
// so the historical backfill must come from /info). No polling.
// ---------------------------------------------------------------------------

export async function fetchCandles(interval: string, days?: number): Promise<Candle[]> {
  const url = `/api/hl/candles?interval=${interval}${days ? `&days=${days}` : ""}`;
  const r = await fetch(url, { cache: "no-store" });
  const json = await r.json();
  if (!Array.isArray(json)) throw new Error(json?.error ?? "bad candles");
  return json as Candle[];
}

// ---------------------------------------------------------------------------
// Aggregation types
// ---------------------------------------------------------------------------

export type WsStatus = "connecting" | "live" | "reconnecting" | "down";

export interface TraderStat {
  addr: string;
  label: TraderLabel;
  buyNtl: number;
  sellNtl: number;
  totalNtl: number;
  netNtl: number;
  buyTrades: number;
  sellTrades: number;
  trades: number;
  baseVol: number;
  firstSeen: number;
  lastSeen: number;
}

export interface FlowStats {
  buyNtl: number;
  sellNtl: number;
  buyTrades: number;
  sellTrades: number;
  delta: number;
  mmNtl: number;
  volBotNtl: number;
  organicNtl: number;
  totalNtl: number;
  totalBaseVol: number;
  totalTrades: number;
  uniqueTraders: number;
  uniqueOrganic: number;
  uniqueBots: number;
  avgTradeNtl: number;
  since: number | null; // ms timestamp of earliest counted trade
}

export interface MarketState {
  status: WsStatus;
  overview: Overview | null;
  book: L2Book | null;
  bbo: { bid: BboLevel | null; ask: BboLevel | null } | null;
  trades: UiTrade[];
  flow: FlowStats;
  traders: TraderStat[];
  liveCandle: Candle | null;
  lastMsgTs: number | null;
}

const MAX_TRADES = 600;
const MAX_STORED_TAPE = 250; // recent tape persisted across reloads
const MAX_TIDS = 10000;
const MAX_STORED_TRADERS = 2000;
const STORE_KEY = `htao-tracker:agg:${PAIR_COIN}:v2`;

const emptyFlow = (): FlowStats => ({
  buyNtl: 0,
  sellNtl: 0,
  buyTrades: 0,
  sellTrades: 0,
  delta: 0,
  mmNtl: 0,
  volBotNtl: 0,
  organicNtl: 0,
  totalNtl: 0,
  totalBaseVol: 0,
  totalTrades: 0,
  uniqueTraders: 0,
  uniqueOrganic: 0,
  uniqueBots: 0,
  avgTradeNtl: 0,
  since: null,
});

function buildOverview(ctx: any): Overview {
  const mark = Number(ctx.markPx);
  const mid = ctx.midPx != null ? Number(ctx.midPx) : null;
  const prevDayPx = Number(ctx.prevDayPx);
  const ref = mid ?? mark;
  const circ = Number(ctx.circulatingSupply);
  const total = Number(ctx.totalSupply);
  return {
    pair: PAIR_NAME,
    base: BASE_TOKEN,
    quote: QUOTE_TOKEN,
    mid,
    mark,
    prevDayPx,
    change24h: ref - prevDayPx,
    changePct24h: prevDayPx ? ((ref - prevDayPx) / prevDayPx) * 100 : 0,
    dayNtlVlm: Number(ctx.dayNtlVlm),
    dayBaseVlm: Number(ctx.dayBaseVlm),
    circulatingSupply: circ,
    totalSupply: total,
    marketCap: circ * mark,
    fdv: total * mark,
    szDecimals: HTAO_SZ_DECIMALS,
    weiDecimals: HTAO_WEI_DECIMALS,
    tokenId: HTAO_TOKEN_ID,
    evmContract: HTAO_EVM_CONTRACT,
    ts: Date.now(),
  };
}

function classify(t: Trade): UiTrade {
  const [buyer, seller] = t.users;
  const buyerLabel = labelFor(buyer);
  const sellerLabel = labelFor(seller);
  const bucket: TraderLabel =
    buyerLabel === "MM" || sellerLabel === "MM"
      ? "MM"
      : buyerLabel === "VOLBOT" || sellerLabel === "VOLBOT"
        ? "VOLBOT"
        : "ORGANIC";
  const px = Number(t.px);
  const sz = Number(t.sz);
  return {
    tid: t.tid,
    time: t.time,
    side: t.side,
    px,
    sz,
    notional: px * sz,
    buyer,
    seller,
    buyerLabel,
    sellerLabel,
    bucket,
  };
}

function topTraders(map: Map<string, TraderStat>, n: number): TraderStat[] {
  return [...map.values()].sort((a, b) => b.totalNtl - a.totalNtl).slice(0, n);
}

// Push freshly-seen trades to the server-side all-time store. Fire-and-forget:
// the route is a no-op when no DATABASE_URL is configured, and `keepalive`
// lets the last batch survive a tab close. Dedup by tid happens server-side.
function postTrades(fresh: UiTrade[]) {
  if (typeof window === "undefined" || fresh.length === 0) return;
  const token = process.env.NEXT_PUBLIC_INGEST_TOKEN;
  try {
    fetch("/api/stats/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { "x-ingest-token": token } : {}),
      },
      keepalive: true,
      body: JSON.stringify({
        trades: fresh.map((t) => ({
          tid: t.tid,
          time: t.time,
          side: t.side,
          px: t.px,
          sz: t.sz,
          buyer: t.buyer,
          seller: t.seller,
          coin: PAIR_COIN,
        })),
      }),
    }).catch(() => {
      /* offline / route error — non-fatal, trade is still in localStorage */
    });
  } catch {
    /* ignore */
  }
}

function recompute(flow: FlowStats, map: Map<string, TraderStat>) {
  flow.delta = flow.buyNtl - flow.sellNtl;
  flow.uniqueTraders = map.size;
  flow.avgTradeNtl = flow.totalTrades ? flow.totalNtl / flow.totalTrades : 0;
  let bots = 0;
  for (const ts of map.values()) if (ts.label !== "ORGANIC") bots += 1;
  flow.uniqueBots = bots;
  flow.uniqueOrganic = flow.uniqueTraders - bots;
}

// ---------------------------------------------------------------------------
// useMarket — one WebSocket, all live data, with cross-session persistence
// of the trader/flow aggregation (so unique traders + volume accumulate
// instead of resetting on reload).
// ---------------------------------------------------------------------------

export function useMarket(candleInterval: string) {
  const [state, setState] = useState<MarketState>({
    status: "connecting",
    overview: null,
    book: null,
    bbo: null,
    trades: [],
    flow: emptyFlow(),
    traders: [],
    liveCandle: null,
    lastMsgTs: null,
  });

  const seenTids = useRef<Set<number>>(new Set());
  const traderMap = useRef<Map<string, TraderStat>>(new Map());
  const flowRef = useRef<FlowStats>(emptyFlow());
  const tradesRef = useRef<UiTrade[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef(candleInterval);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- persistence ---------------------------------------------------------
  const persist = useCallback(() => {
    if (typeof window === "undefined") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const tids = [...seenTids.current];
        const payload = {
          flow: flowRef.current,
          traders: topTraders(traderMap.current, MAX_STORED_TRADERS),
          tids: tids.slice(-MAX_TIDS),
          trades: tradesRef.current.slice(0, MAX_STORED_TAPE),
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(payload));
      } catch {
        /* quota / serialization — non-fatal */
      }
    }, 1500);
  }, []);

  const reset = useCallback(() => {
    seenTids.current = new Set();
    traderMap.current = new Map();
    flowRef.current = emptyFlow();
    tradesRef.current = [];
    if (typeof window !== "undefined") localStorage.removeItem(STORE_KEY);
    setState((s) => ({ ...s, flow: emptyFlow(), traders: [], trades: [] }));
  }, []);

  // load persisted aggregation once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p?.flow) flowRef.current = { ...emptyFlow(), ...p.flow };
      if (Array.isArray(p?.traders)) {
        for (const t of p.traders as TraderStat[]) traderMap.current.set(t.addr.toLowerCase(), t);
      }
      if (Array.isArray(p?.tids)) seenTids.current = new Set(p.tids as number[]);
      if (Array.isArray(p?.trades)) tradesRef.current = p.trades as UiTrade[];
      recompute(flowRef.current, traderMap.current);
      setState((s) => ({
        ...s,
        flow: { ...flowRef.current },
        traders: topTraders(traderMap.current, 20),
        trades: tradesRef.current,
      }));
    } catch {
      /* ignore corrupt store */
    }
  }, []);

  const ingest = useCallback(
    (raw: Trade[]) => {
      const fresh: UiTrade[] = [];
      for (const t of raw) {
        if (t.coin !== PAIR_COIN) continue;
        if (seenTids.current.has(t.tid)) continue;
        seenTids.current.add(t.tid);
        const ui = classify(t);
        fresh.push(ui);

        const f = flowRef.current;
        f.totalNtl += ui.notional;
        f.totalBaseVol += ui.sz;
        f.totalTrades += 1;
        f.since = f.since == null ? ui.time : Math.min(f.since, ui.time);
        if (ui.side === "B") {
          f.buyNtl += ui.notional;
          f.buyTrades += 1;
        } else {
          f.sellNtl += ui.notional;
          f.sellTrades += 1;
        }
        if (ui.bucket === "MM") f.mmNtl += ui.notional;
        else if (ui.bucket === "VOLBOT") f.volBotNtl += ui.notional;
        else f.organicNtl += ui.notional;

        for (const addr of [ui.buyer, ui.seller]) {
          const isBuyer = addr === ui.buyer;
          const key = addr.toLowerCase();
          let ts = traderMap.current.get(key);
          if (!ts) {
            ts = {
              addr,
              label: labelFor(addr),
              buyNtl: 0,
              sellNtl: 0,
              totalNtl: 0,
              netNtl: 0,
              buyTrades: 0,
              sellTrades: 0,
              trades: 0,
              baseVol: 0,
              firstSeen: ui.time,
              lastSeen: ui.time,
            };
            traderMap.current.set(key, ts);
          }
          ts.trades += 1;
          ts.totalNtl += ui.notional;
          ts.baseVol += ui.sz;
          ts.lastSeen = Math.max(ts.lastSeen, ui.time);
          ts.firstSeen = Math.min(ts.firstSeen, ui.time);
          if (isBuyer) {
            ts.buyNtl += ui.notional;
            ts.buyTrades += 1;
          } else {
            ts.sellNtl += ui.notional;
            ts.sellTrades += 1;
          }
          ts.netNtl = ts.buyNtl - ts.sellNtl;
        }
      }
      if (fresh.length === 0) return;

      recompute(flowRef.current, traderMap.current);
      const top = topTraders(traderMap.current, 20);
      const merged = [...fresh.sort((a, b) => b.time - a.time), ...tradesRef.current].slice(
        0,
        MAX_TRADES,
      );
      tradesRef.current = merged;
      persist();
      postTrades(fresh);

      setState((s) => ({
        ...s,
        trades: merged,
        flow: { ...flowRef.current },
        traders: top,
        lastMsgTs: Date.now(),
      }));
    },
    [persist],
  );

  // --- the single WebSocket -----------------------------------------------
  useEffect(() => {
    let closed = false;
    let pingTimer: ReturnType<typeof setInterval>;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let attempt = 0;

    const sub = (ws: WebSocket, subscription: object) =>
      ws.send(JSON.stringify({ method: "subscribe", subscription }));

    const connect = () => {
      setState((s) => ({ ...s, status: attempt === 0 ? "connecting" : "reconnecting" }));
      const ws = new WebSocket(HL_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setState((s) => ({ ...s, status: "live" }));
        sub(ws, { type: "activeAssetCtx", coin: PAIR_COIN });
        sub(ws, { type: "l2Book", coin: PAIR_COIN });
        sub(ws, { type: "bbo", coin: PAIR_COIN });
        sub(ws, { type: "trades", coin: PAIR_COIN });
        sub(ws, { type: "candle", coin: PAIR_COIN, interval: intervalRef.current });
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ method: "ping" }));
        }, 30000);
      };

      ws.onmessage = (ev) => {
        let msg: any;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        switch (msg.channel) {
          case "trades":
            if (Array.isArray(msg.data)) ingest(msg.data as Trade[]);
            break;
          case "activeSpotAssetCtx":
          case "activeAssetCtx":
            if (msg.data?.ctx)
              setState((s) => ({
                ...s,
                overview: buildOverview(msg.data.ctx),
                lastMsgTs: Date.now(),
              }));
            break;
          case "l2Book":
            if (msg.data?.levels)
              setState((s) => ({ ...s, book: msg.data as L2Book, lastMsgTs: Date.now() }));
            break;
          case "bbo":
            if (msg.data?.bbo) {
              const [bid, ask] = msg.data.bbo;
              setState((s) => ({ ...s, bbo: { bid: bid ?? null, ask: ask ?? null } }));
            }
            break;
          case "candle":
            if (msg.data) {
              const c = Array.isArray(msg.data) ? msg.data[msg.data.length - 1] : msg.data;
              if (c?.i === intervalRef.current)
                setState((s) => ({ ...s, liveCandle: c as Candle, lastMsgTs: Date.now() }));
            }
            break;
        }
      };

      ws.onclose = () => {
        clearInterval(pingTimer);
        if (closed) return;
        attempt += 1;
        const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4));
        setState((s) => ({ ...s, status: "reconnecting" }));
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      wsRef.current?.close();
    };
  }, [ingest]);

  // --- resubscribe candle when the chart interval changes ------------------
  useEffect(() => {
    const prev = intervalRef.current;
    intervalRef.current = candleInterval;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || prev === candleInterval) return;
    ws.send(
      JSON.stringify({
        method: "unsubscribe",
        subscription: { type: "candle", coin: PAIR_COIN, interval: prev },
      }),
    );
    ws.send(
      JSON.stringify({
        method: "subscribe",
        subscription: { type: "candle", coin: PAIR_COIN, interval: candleInterval },
      }),
    );
    setState((s) => ({ ...s, liveCandle: null }));
  }, [candleInterval]);

  return { ...state, reset };
}

/** A ticking clock for relative-time displays. */
export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
