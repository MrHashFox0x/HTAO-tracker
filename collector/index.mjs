// ---------------------------------------------------------------------------
// HTAO-tracker — 24/7 trades collector
//
// Holds a single Hyperliquid WebSocket open forever, subscribes to the public
// `trades` feed for the HTAO/USDC (@307) spot pair, and writes EVERY trade into
// Postgres (dedup by tid). Also snapshots price + rolling 24h volume + supply
// every minute. This is the piece that CANNOT live on Vercel — it needs an
// always-on process (Railway / Fly / a VPS / a box at home).
//
// Why this exists: Hyperliquid has no historical-trades REST endpoint, so the
// only way to build an all-time view of who traded the pair is to record trades
// as they happen. "All-time" therefore means "since this collector first ran" —
// deploy it once and leave it running.
//
// Run:  DATABASE_URL=postgres://... node index.mjs
// ---------------------------------------------------------------------------

import "dotenv/config"; // loads collector/.env when present; no-op on hosts that inject env vars
import pg from "pg";
import WebSocket from "ws";

// --- config ----------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is required");
  process.exit(1);
}

const COIN = process.env.COIN ?? "@307";
const HL_WS_URL = process.env.HL_WS_URL ?? "wss://api.hyperliquid.xyz/ws";
const SNAPSHOT_EVERY_MS = Number(process.env.SNAPSHOT_EVERY_MS ?? 60_000);
// Supabase/Neon poolers want SSL; allow opt-out for a local Postgres.
const SSL = process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false };

// MentatMinds internal addresses (mirror of ../lib/hl.ts — keep in sync).
const MM_ADDRESS = "0x11f9a5bd171bdb5f71126d59276072f4b76dcf00";
const VOL_BOT_ADDRESS = "0x54952f67751112c880bc1369181b0cbaa00f1f81";

function labelFor(addr) {
  const a = (addr ?? "").toLowerCase();
  if (a === MM_ADDRESS) return "MM";
  if (a === VOL_BOT_ADDRESS) return "VOLBOT";
  return "ORGANIC";
}

// Single-bucket classification, precedence MM > VOLBOT > ORGANIC.
function bucketFor(buyerLabel, sellerLabel) {
  if (buyerLabel === "MM" || sellerLabel === "MM") return "MM";
  if (buyerLabel === "VOLBOT" || sellerLabel === "VOLBOT") return "VOLBOT";
  return "ORGANIC";
}

// --- schema (inline mirror of ../db/schema.sql; idempotent) -----------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS trades (
  tid           BIGINT           PRIMARY KEY,
  coin          TEXT             NOT NULL,
  ts            BIGINT           NOT NULL,
  side          CHAR(1)          NOT NULL,
  px            DOUBLE PRECISION NOT NULL,
  sz            DOUBLE PRECISION NOT NULL,
  notional      DOUBLE PRECISION NOT NULL,
  buyer         TEXT             NOT NULL,
  seller        TEXT             NOT NULL,
  buyer_label   TEXT             NOT NULL,
  seller_label  TEXT             NOT NULL,
  bucket        TEXT             NOT NULL,
  hash          TEXT,
  ingested_at   TIMESTAMPTZ      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trades_ts_idx     ON trades (ts DESC);
CREATE INDEX IF NOT EXISTS trades_buyer_idx  ON trades (buyer);
CREATE INDEX IF NOT EXISTS trades_seller_idx ON trades (seller);
CREATE INDEX IF NOT EXISTS trades_bucket_idx ON trades (bucket);
CREATE TABLE IF NOT EXISTS market_snapshots (
  ts            BIGINT           PRIMARY KEY,
  mark          DOUBLE PRECISION,
  mid           DOUBLE PRECISION,
  prev_day_px   DOUBLE PRECISION,
  day_ntl_vlm   DOUBLE PRECISION,
  day_base_vlm  DOUBLE PRECISION,
  circ_supply   DOUBLE PRECISION,
  total_supply  DOUBLE PRECISION
);
`;

// --- db ---------------------------------------------------------------------

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: SSL,
  max: 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => console.error("[pg] pool error:", err.message));

async function ensureSchema() {
  await pool.query(SCHEMA_SQL);
  console.log("[pg] schema ready");
}

let inserted = 0;
let lastSnapshotAt = 0;

async function insertTrades(rows) {
  if (rows.length === 0) return;
  // 13 columns; Postgres caps at 65535 params -> chunk well under that.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    slice.forEach((r, j) => {
      const b = j * 13;
      values.push(
        `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13})`,
      );
      params.push(
        r.tid, r.coin, r.ts, r.side, r.px, r.sz, r.notional,
        r.buyer, r.seller, r.buyerLabel, r.sellerLabel, r.bucket, r.hash,
      );
    });
    const sql =
      `INSERT INTO trades
         (tid, coin, ts, side, px, sz, notional, buyer, seller, buyer_label, seller_label, bucket, hash)
       VALUES ${values.join(",")}
       ON CONFLICT (tid) DO NOTHING`;
    const res = await pool.query(sql, params);
    inserted += res.rowCount;
  }
}

async function insertSnapshot(ctx) {
  const ts = Date.now();
  if (ts - lastSnapshotAt < SNAPSHOT_EVERY_MS) return;
  lastSnapshotAt = ts;
  const n = (v) => (v == null ? null : Number(v));
  await pool.query(
    `INSERT INTO market_snapshots
       (ts, mark, mid, prev_day_px, day_ntl_vlm, day_base_vlm, circ_supply, total_supply)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (ts) DO NOTHING`,
    [
      ts, n(ctx.markPx), n(ctx.midPx), n(ctx.prevDayPx),
      n(ctx.dayNtlVlm), n(ctx.dayBaseVlm), n(ctx.circulatingSupply), n(ctx.totalSupply),
    ],
  );
}

function toRow(t) {
  if (t.coin !== COIN || !Array.isArray(t.users)) return null;
  const [buyer, seller] = t.users;
  const buyerLabel = labelFor(buyer);
  const sellerLabel = labelFor(seller);
  const px = Number(t.px);
  const sz = Number(t.sz);
  return {
    tid: t.tid,
    coin: t.coin,
    ts: t.time,
    side: t.side, // 'B' | 'A'
    px,
    sz,
    notional: px * sz,
    buyer,
    seller,
    buyerLabel,
    sellerLabel,
    bucket: bucketFor(buyerLabel, sellerLabel),
    hash: t.hash ?? null,
  };
}

// --- websocket --------------------------------------------------------------

let ws = null;
let pingTimer = null;
let attempt = 0;
let stopping = false;

function connect() {
  console.log(`[ws] connecting ${HL_WS_URL} for ${COIN}`);
  ws = new WebSocket(HL_WS_URL);

  ws.on("open", () => {
    attempt = 0;
    console.log("[ws] open — subscribing trades + activeAssetCtx");
    ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "trades", coin: COIN } }));
    ws.send(
      JSON.stringify({ method: "subscribe", subscription: { type: "activeAssetCtx", coin: COIN } }),
    );
    clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ method: "ping" }));
    }, 30_000);
  });

  ws.on("message", async (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }
    try {
      if (msg.channel === "trades" && Array.isArray(msg.data)) {
        const rows = msg.data.map(toRow).filter(Boolean);
        if (rows.length) {
          const before = inserted;
          await insertTrades(rows);
          const added = inserted - before;
          if (added > 0) console.log(`[trades] +${added} (seen ${rows.length})`);
        }
      } else if (
        (msg.channel === "activeSpotAssetCtx" || msg.channel === "activeAssetCtx") &&
        msg.data?.ctx
      ) {
        await insertSnapshot(msg.data.ctx);
      }
    } catch (err) {
      console.error("[ingest] error:", err.message);
    }
  });

  ws.on("close", () => {
    clearInterval(pingTimer);
    if (stopping) return;
    attempt += 1;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
    console.warn(`[ws] closed — reconnecting in ${delay}ms (attempt ${attempt})`);
    setTimeout(connect, delay);
  });

  ws.on("error", (err) => {
    console.error("[ws] error:", err.message);
    ws.close();
  });
}

// --- lifecycle --------------------------------------------------------------

async function shutdown(signal) {
  console.log(`\n[exit] ${signal} — closing (inserted ${inserted} trades this run)`);
  stopping = true;
  clearInterval(pingTimer);
  try {
    ws?.close();
  } catch {}
  try {
    await pool.end();
  } catch {}
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

(async () => {
  await ensureSchema();
  connect();
  setInterval(() => console.log(`[heartbeat] inserted ${inserted} trades this run`), 300_000);
})().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
