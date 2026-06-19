import { NextResponse } from "next/server";
import { getPool, DB_CONFIGURED } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// All-time flow + leaderboard, aggregated on the fly from the trades table.
// Returns shapes that map 1:1 onto the client's FlowStats / TraderStat so the
// existing panels render DB data unchanged.

const SUMMARY_SQL = `
  SELECT
    COUNT(*)                                                    AS total_trades,
    COALESCE(SUM(notional), 0)                                  AS total_ntl,
    COALESCE(SUM(sz), 0)                                        AS total_base,
    COALESCE(SUM(notional) FILTER (WHERE side = 'B'), 0)        AS buy_ntl,
    COALESCE(SUM(notional) FILTER (WHERE side = 'A'), 0)        AS sell_ntl,
    COUNT(*) FILTER (WHERE side = 'B')                          AS buy_trades,
    COUNT(*) FILTER (WHERE side = 'A')                          AS sell_trades,
    COALESCE(SUM(notional) FILTER (WHERE bucket = 'MM'), 0)     AS mm_ntl,
    COALESCE(SUM(notional) FILTER (WHERE bucket = 'VOLBOT'), 0) AS volbot_ntl,
    COALESCE(SUM(notional) FILTER (WHERE bucket = 'ORGANIC'), 0)AS organic_ntl,
    MIN(ts)                                                     AS since
  FROM trades
`;

const UNIQUES_SQL = `
  WITH legs AS (
    SELECT buyer  AS addr, buyer_label  AS label FROM trades
    UNION ALL
    SELECT seller AS addr, seller_label AS label FROM trades
  )
  SELECT
    COUNT(DISTINCT addr)                                       AS unique_traders,
    COUNT(DISTINCT addr) FILTER (WHERE label = 'ORGANIC')      AS unique_organic,
    COUNT(DISTINCT addr) FILTER (WHERE label <> 'ORGANIC')     AS unique_bots
  FROM legs
`;

const LEADERBOARD_SQL = `
  WITH legs AS (
    SELECT buyer  AS addr, buyer_label  AS label, notional, sz, ts, 'buy'  AS leg FROM trades
    UNION ALL
    SELECT seller AS addr, seller_label AS label, notional, sz, ts, 'sell' AS leg FROM trades
  )
  SELECT
    addr,
    MAX(label)                                          AS label,
    COALESCE(SUM(notional) FILTER (WHERE leg = 'buy'), 0)  AS buy_ntl,
    COALESCE(SUM(notional) FILTER (WHERE leg = 'sell'), 0) AS sell_ntl,
    SUM(notional)                                       AS total_ntl,
    COUNT(*) FILTER (WHERE leg = 'buy')                 AS buy_trades,
    COUNT(*) FILTER (WHERE leg = 'sell')                AS sell_trades,
    COUNT(*)                                            AS trades,
    SUM(sz)                                             AS base_vol,
    MIN(ts)                                             AS first_seen,
    MAX(ts)                                             AS last_seen
  FROM legs
  GROUP BY addr
  ORDER BY total_ntl DESC
  LIMIT $1
`;

export async function GET(req: Request) {
  if (!DB_CONFIGURED) return NextResponse.json({ configured: false });
  const pool = getPool();
  if (!pool) return NextResponse.json({ configured: false });

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 100), 500);

  try {
    const [summary, uniques, leaderboard] = await Promise.all([
      pool.query(SUMMARY_SQL),
      pool.query(UNIQUES_SQL),
      pool.query(LEADERBOARD_SQL, [limit]),
    ]);

    const s = summary.rows[0];
    const u = uniques.rows[0];
    const num = (v: unknown) => Number(v ?? 0);

    const totalTrades = num(s.total_trades);
    const totalNtl = num(s.total_ntl);
    const buyNtl = num(s.buy_ntl);
    const sellNtl = num(s.sell_ntl);

    const flow = {
      buyNtl,
      sellNtl,
      buyTrades: num(s.buy_trades),
      sellTrades: num(s.sell_trades),
      delta: buyNtl - sellNtl,
      mmNtl: num(s.mm_ntl),
      volBotNtl: num(s.volbot_ntl),
      organicNtl: num(s.organic_ntl),
      totalNtl,
      totalBaseVol: num(s.total_base),
      totalTrades,
      uniqueTraders: num(u.unique_traders),
      uniqueOrganic: num(u.unique_organic),
      uniqueBots: num(u.unique_bots),
      avgTradeNtl: totalTrades ? totalNtl / totalTrades : 0,
      since: s.since != null ? Number(s.since) : null,
    };

    const traders = leaderboard.rows.map((r) => {
      const buy = num(r.buy_ntl);
      const sell = num(r.sell_ntl);
      return {
        addr: r.addr as string,
        label: r.label as "MM" | "VOLBOT" | "ORGANIC",
        buyNtl: buy,
        sellNtl: sell,
        totalNtl: num(r.total_ntl),
        netNtl: buy - sell,
        buyTrades: num(r.buy_trades),
        sellTrades: num(r.sell_trades),
        trades: num(r.trades),
        baseVol: num(r.base_vol),
        firstSeen: num(r.first_seen),
        lastSeen: num(r.last_seen),
      };
    });

    return NextResponse.json(
      { configured: true, ready: true, generatedAt: Date.now(), flow, traders },
      { headers: { "Cache-Control": "s-maxage=5, stale-while-revalidate=15" } },
    );
  } catch (err) {
    // Table not created yet (collector never ran) or transient DB error: tell
    // the client we're configured-but-not-ready so it keeps the live fallback.
    return NextResponse.json({
      configured: true,
      ready: false,
      error: err instanceof Error ? err.message : "db error",
    });
  }
}
