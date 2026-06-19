import { NextResponse } from "next/server";
import { getPool, DB_CONFIGURED } from "@/lib/db";
import { PAIR_COIN, MM_ADDRESS, VOL_BOT_ADDRESS } from "@/lib/hl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Browser-fed ingest: the open dashboard tab POSTs each new trade here and we
// upsert it into Postgres (dedup by tid). This makes the all-time store grow
// from any open tab — no 24/7 collector required, at the cost of only
// recording while a tab is open.
//
// Trust model: this is a public write path, so we (a) classify labels/bucket
// server-side from the known addresses (never trust client labels), (b) hard-
// validate every field, and (c) optionally gate on INGEST_TOKEN. Note the token
// ships to the browser, so it's a speed bump against casual abuse, not real
// auth — a browser-written DB is inherently spoofable.
// ---------------------------------------------------------------------------

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const MAX_BATCH = 500;
const MM = MM_ADDRESS.toLowerCase();
const VOL = VOL_BOT_ADDRESS.toLowerCase();

// Self-bootstrapping schema: the first ingest on a cold instance creates the
// table if it doesn't exist, so a fresh Postgres needs zero manual setup and no
// collector. Guarded so it only runs once per server instance.
let schemaReady = false;
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS trades (
    tid          BIGINT           PRIMARY KEY,
    coin         TEXT             NOT NULL,
    ts           BIGINT           NOT NULL,
    side         CHAR(1)          NOT NULL,
    px           DOUBLE PRECISION NOT NULL,
    sz           DOUBLE PRECISION NOT NULL,
    notional     DOUBLE PRECISION NOT NULL,
    buyer        TEXT             NOT NULL,
    seller       TEXT             NOT NULL,
    buyer_label  TEXT             NOT NULL,
    seller_label TEXT             NOT NULL,
    bucket       TEXT             NOT NULL,
    hash         TEXT,
    ingested_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS trades_ts_idx     ON trades (ts DESC);
  CREATE INDEX IF NOT EXISTS trades_buyer_idx  ON trades (buyer);
  CREATE INDEX IF NOT EXISTS trades_seller_idx ON trades (seller);
  CREATE INDEX IF NOT EXISTS trades_bucket_idx ON trades (bucket);
`;

async function ensureSchema(pool: import("pg").Pool) {
  if (schemaReady) return;
  await pool.query(SCHEMA_SQL);
  schemaReady = true;
}

function labelFor(addr: string): "MM" | "VOLBOT" | "ORGANIC" {
  const a = addr.toLowerCase();
  if (a === MM) return "MM";
  if (a === VOL) return "VOLBOT";
  return "ORGANIC";
}

interface Row {
  tid: number;
  ts: number;
  side: string;
  px: number;
  sz: number;
  notional: number;
  buyer: string;
  seller: string;
  buyerLabel: string;
  sellerLabel: string;
  bucket: string;
  hash: string | null;
}

function validate(t: unknown): Row | null {
  if (!t || typeof t !== "object") return null;
  const o = t as Record<string, unknown>;
  if (o.coin !== PAIR_COIN) return null;
  const tid = Number(o.tid);
  const ts = Number(o.time);
  const px = Number(o.px);
  const sz = Number(o.sz);
  const side = o.side;
  const buyer = typeof o.buyer === "string" ? o.buyer : "";
  const seller = typeof o.seller === "string" ? o.seller : "";
  if (!Number.isFinite(tid) || tid <= 0) return null;
  if (!Number.isFinite(ts) || ts <= 0) return null;
  if (!Number.isFinite(px) || px <= 0) return null;
  if (!Number.isFinite(sz) || sz <= 0) return null;
  if (side !== "B" && side !== "A") return null;
  if (!ADDR_RE.test(buyer) || !ADDR_RE.test(seller)) return null;

  const buyerLabel = labelFor(buyer);
  const sellerLabel = labelFor(seller);
  const bucket =
    buyerLabel === "MM" || sellerLabel === "MM"
      ? "MM"
      : buyerLabel === "VOLBOT" || sellerLabel === "VOLBOT"
        ? "VOLBOT"
        : "ORGANIC";
  return {
    tid,
    ts,
    side,
    px,
    sz,
    notional: px * sz,
    buyer,
    seller,
    buyerLabel,
    sellerLabel,
    bucket,
    hash: typeof o.hash === "string" ? o.hash : null,
  };
}

export async function POST(req: Request) {
  if (!DB_CONFIGURED) return NextResponse.json({ configured: false, inserted: 0 });

  const token = process.env.INGEST_TOKEN;
  if (token && req.headers.get("x-ingest-token") !== token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ configured: false, inserted: 0 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const raw = (body as { trades?: unknown })?.trades;
  if (!Array.isArray(raw)) return NextResponse.json({ error: "trades[] required" }, { status: 400 });

  const rows = raw.slice(0, MAX_BATCH).map(validate).filter((r): r is Row => r !== null);
  if (rows.length === 0) return NextResponse.json({ configured: true, inserted: 0 });

  try {
    await ensureSchema(pool);
    const values: string[] = [];
    const params: unknown[] = [];
    rows.forEach((r, j) => {
      const b = j * 13;
      values.push(
        `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13})`,
      );
      params.push(
        r.tid, PAIR_COIN, r.ts, r.side, r.px, r.sz, r.notional,
        r.buyer, r.seller, r.buyerLabel, r.sellerLabel, r.bucket, r.hash,
      );
    });
    const res = await pool.query(
      `INSERT INTO trades
         (tid, coin, ts, side, px, sz, notional, buyer, seller, buyer_label, seller_label, bucket, hash)
       VALUES ${values.join(",")}
       ON CONFLICT (tid) DO NOTHING`,
      params,
    );
    return NextResponse.json({ configured: true, inserted: res.rowCount });
  } catch (err) {
    return NextResponse.json(
      { configured: true, inserted: 0, error: err instanceof Error ? err.message : "db error" },
      { status: 500 },
    );
  }
}
