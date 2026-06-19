import { NextResponse } from "next/server";
import { getPool, DB_CONFIGURED } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recent trades from the all-time store, newest first. Powers tape scrollback
// (the live WS only backfills ~30 on connect). `before` paginates by tid.

export async function GET(req: Request) {
  if (!DB_CONFIGURED) return NextResponse.json({ configured: false, trades: [] });
  const pool = getPool();
  if (!pool) return NextResponse.json({ configured: false, trades: [] });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 1000);
  const before = url.searchParams.get("before");

  try {
    const rows = before
      ? (
          await pool.query(
            `SELECT tid, ts, side, px, sz, notional, buyer, seller, buyer_label, seller_label, bucket
             FROM trades WHERE tid < $1 ORDER BY ts DESC LIMIT $2`,
            [before, limit],
          )
        ).rows
      : (
          await pool.query(
            `SELECT tid, ts, side, px, sz, notional, buyer, seller, buyer_label, seller_label, bucket
             FROM trades ORDER BY ts DESC LIMIT $1`,
            [limit],
          )
        ).rows;

    const trades = rows.map((r) => ({
      tid: Number(r.tid),
      time: Number(r.ts),
      side: r.side as "B" | "A",
      px: Number(r.px),
      sz: Number(r.sz),
      notional: Number(r.notional),
      buyer: r.buyer as string,
      seller: r.seller as string,
      buyerLabel: r.buyer_label as "MM" | "VOLBOT" | "ORGANIC",
      sellerLabel: r.seller_label as "MM" | "VOLBOT" | "ORGANIC",
      bucket: r.bucket as "MM" | "VOLBOT" | "ORGANIC",
    }));

    return NextResponse.json(
      { configured: true, ready: true, trades },
      { headers: { "Cache-Control": "s-maxage=3, stale-while-revalidate=10" } },
    );
  } catch (err) {
    return NextResponse.json({
      configured: true,
      ready: false,
      trades: [],
      error: err instanceof Error ? err.message : "db error",
    });
  }
}
