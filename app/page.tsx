"use client";

import { useCallback, useState } from "react";
import { Header } from "@/components/Header";
import { StatsBar, type DailyDerived } from "@/components/StatsBar";
import { PriceChart } from "@/components/PriceChart";
import { VolumeChart } from "@/components/VolumeChart";
import { OrderBook } from "@/components/OrderBook";
import { TradeTape } from "@/components/TradeTape";
import { FlowPanel } from "@/components/FlowPanel";
import { TradersPanel } from "@/components/TradersPanel";
import { HoldersPanel } from "@/components/HoldersPanel";
import { useMarket, useClock } from "@/lib/useHL";
import { useAllTime, mergeTapes } from "@/lib/useAllTime";

export default function Page() {
  const [interval, setInterval] = useState("1h");
  const m = useMarket(interval);
  const db = useAllTime();
  const now = useClock();

  // Prefer the server-side all-time store when it's configured, ready, and the
  // user hasn't flipped to the live session view. Otherwise fall back to the
  // live WS + localStorage aggregation (works with no backend).
  const [allTime, setAllTime] = useState(true);
  const dbActive = db.configured && db.ready && allTime;

  const flow = dbActive && db.flow ? db.flow : m.flow;
  const traders = dbActive ? db.traders : m.traders;
  const tape = dbActive ? mergeTapes(m.trades, db.trades) : m.trades;
  const scope: "all-time" | "session" = dbActive ? "all-time" : "session";

  const [daily, setDaily] = useState<DailyDerived>({ high: null, low: null, trades: null });
  const onDaily = useCallback((d: DailyDerived) => setDaily(d), []);

  return (
    <div className="min-h-screen bg-page">
      <Header ov={m.overview} status={m.status} />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        <StatsBar ov={m.overview} daily={daily} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <PriceChart
              interval={interval}
              onIntervalChange={setInterval}
              liveCandle={m.liveCandle}
              onDaily={onDaily}
            />
          </div>
          <OrderBook book={m.book} />
        </div>

        <VolumeChart />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TradeTape trades={tape} />
          <FlowPanel flow={flow} scope={scope} />
        </div>

        <TradersPanel
          traders={traders}
          flow={flow}
          now={now}
          scope={scope}
          dbConfigured={db.configured && db.ready}
          allTime={allTime}
          onToggleScope={db.configured && db.ready ? () => setAllTime((v) => !v) : undefined}
          onReset={dbActive ? undefined : m.reset}
        />

        <HoldersPanel ov={m.overview} />

        <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pb-4 font-mono text-[10px] text-ink-3">
          <span>
            data <span className="text-ink-2">api.hyperliquid.xyz</span> · spot @307 · live
            WebSocket (price · book · trades · candles)
          </span>
          <span>
            {db.configured && db.ready
              ? "trader / flow metrics are all-time from the 24/7 collector → Postgres"
              : "trader / flow metrics accumulate locally across reloads (no collector configured)"}{" "}
            · 24h aggregates from HL
          </span>
          <span className="tnum">
            {new Date(now).toISOString().replace("T", " ").slice(0, 19)} UTC
          </span>
        </footer>
      </main>
    </div>
  );
}
