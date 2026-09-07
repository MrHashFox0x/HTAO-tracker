import { NextResponse } from "next/server";
import { getPool, DB_CONFIGURED } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily volume buckets from the all-time trades store, UTC-aligned so they
// line up 1:1 with Hyperliquid 1d candles (which open at 00:00 UTC). The
// client merges these exact figures with candle-based estimates for the days
// before the collector existed.

const DAILY_SQL = `
  SELECT
    (ts / 86400000) * 86400000   AS day,
    COALESCE(SUM(notional), 0)   AS ntl,
    COALESCE(SUM(sz), 0)         AS base,
    COUNT(*)                     AS trades
  FROM trades
  GROUP BY 1
  ORDER BY 1
`;

export async function GET() {
  if (!DB_CONFIGURED) return NextResponse.json({ configured: false });
  const pool = getPool();
  if (!pool) return NextResponse.json({ configured: false });

  try {
    const [daily, since] = await Promise.all([
      pool.query(DAILY_SQL),
      pool.query("SELECT MIN(ts) AS since FROM trades"),
    ]);

    const days = daily.rows.map((r) => ({
      t: Number(r.day),
      ntl: Number(r.ntl),
      base: Number(r.base),
      trades: Number(r.trades),
    }));
    const s = since.rows[0]?.since;

    return NextResponse.json(
      {
        configured: true,
        ready: days.length > 0,
        generatedAt: Date.now(),
        since: s != null ? Number(s) : null,
        days,
      },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    return NextResponse.json({
      configured: true,
      ready: false,
      error: err instanceof Error ? err.message : "db error",
    });
  }
}
