import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// HTAO spot holders via Hypurrscan (HyperCore balances aren't listable through
// the official HL info API). Cached in-memory; on upstream failure we serve
// the last good snapshot so the panel degrades instead of blanking.

const UPSTREAM = "https://api.hypurrscan.io/holders/HTAO";
const TTL_MS = 60_000;

interface Holder {
  addr: string;
  balance: number;
}

interface Snapshot {
  t: number;
  lastUpdate: number | null;
  totalHeld: number;
  /** Balance parked on the HyperCore system address (bridge-side supply). */
  systemBalance: number;
  holders: Holder[];
}

// HIP-1 system address (0x2000…) — holds the token's non-HyperCore supply.
const SYSTEM_PREFIX = "0x200000000000000000000000000000000000";

// Below this the wallet is dust, not a holder (~$3 at current prices).
const MIN_BALANCE = 0.01;

let cache: Snapshot | null = null;

export async function GET() {
  if (cache && Date.now() - cache.t < TTL_MS) {
    return NextResponse.json(cache);
  }

  try {
    const r = await fetch(UPSTREAM, { cache: "no-store" });
    if (!r.ok) throw new Error(`hypurrscan ${r.status}`);
    const data = (await r.json()) as {
      lastUpdate?: number;
      holders?: Record<string, number>;
    };
    if (!data.holders || typeof data.holders !== "object") {
      throw new Error("bad payload");
    }

    const all = Object.entries(data.holders)
      .map(([addr, balance]) => ({ addr: addr.toLowerCase(), balance: Number(balance) }))
      .filter((h) => isFinite(h.balance) && h.balance >= MIN_BALANCE);

    const systemBalance = all
      .filter((h) => h.addr.startsWith(SYSTEM_PREFIX))
      .reduce((s, h) => s + h.balance, 0);
    const holders = all
      .filter((h) => !h.addr.startsWith(SYSTEM_PREFIX))
      .sort((a, b) => b.balance - a.balance);

    cache = {
      t: Date.now(),
      lastUpdate: data.lastUpdate ? data.lastUpdate * 1000 : null,
      totalHeld: holders.reduce((s, h) => s + h.balance, 0),
      systemBalance,
      holders,
    };
    return NextResponse.json(cache);
  } catch (e) {
    if (cache) return NextResponse.json(cache);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 },
    );
  }
}
