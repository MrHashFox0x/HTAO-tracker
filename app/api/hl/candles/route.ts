import { NextRequest, NextResponse } from "next/server";
import { HL_INFO_URL, PAIR_COIN, CANDLE_INTERVALS } from "@/lib/hl";

export const dynamic = "force-dynamic";

const VALID = new Set(CANDLE_INTERVALS.map((c) => c.value as string));

const cache = new Map<string, { t: number; data: unknown }>();
const TTL_MS = 5000;

export async function GET(req: NextRequest) {
  const interval = req.nextUrl.searchParams.get("interval") ?? "1h";
  if (!VALID.has(interval)) {
    return NextResponse.json({ error: "bad interval" }, { status: 400 });
  }
  const meta = CANDLE_INTERVALS.find((c) => c.value === interval)!;
  const days = Number(req.nextUrl.searchParams.get("days")) || meta.days;

  const key = `${interval}:${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) {
    return NextResponse.json(hit.data);
  }

  const endTime = Date.now();
  const startTime = endTime - days * 86_400_000;

  try {
    const r = await fetch(HL_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "candleSnapshot",
        req: { coin: PAIR_COIN, interval, startTime, endTime },
      }),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`HL ${r.status}`);
    const data = await r.json();
    cache.set(key, { t: Date.now(), data });
    return NextResponse.json(data);
  } catch (e: any) {
    if (hit) return NextResponse.json(hit.data);
    return NextResponse.json({ error: e?.message ?? "fetch failed" }, { status: 502 });
  }
}
