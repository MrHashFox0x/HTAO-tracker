"use client";

import { useCallback, useState } from "react";
import { Header } from "@/components/Header";
import { StatsBar, type DailyDerived } from "@/components/StatsBar";
import { PriceChart } from "@/components/PriceChart";
import { OrderBook } from "@/components/OrderBook";
import { TradeTape } from "@/components/TradeTape";
import { FlowPanel } from "@/components/FlowPanel";
import { TradersPanel } from "@/components/TradersPanel";
import { TokenInfo } from "@/components/TokenInfo";
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
    <main className="mx-auto min-h-screen max-w-[1800px] p-2 md:p-3">
      <Header ov={m.overview} status={m.status} now={now} />

      <StatsBar ov={m.overview} daily={daily} />

      <div className="mb-2 grid grid-cols-1 gap-2 xl:grid-cols-3">
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

      <div className="mb-2 grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
        <TradeTape trades={tape} />
        <FlowPanel flow={flow} scope={scope} />
        <TokenInfo ov={m.overview} />
      </div>

      <div className="mb-2">
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
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 py-2 text-[10px] text-term-muted">
        <span>
          DATA · <span className="text-term-dim">api.hyperliquid.xyz</span> · spot @307 · live
          WebSocket (price · book · trades · candles)
        </span>
        <span>
          {db.configured && db.ready
            ? "Trader / flow metrics are all-time from the 24/7 collector → Postgres."
            : "Trader / flow metrics accumulate locally across reloads (no collector configured)."}{" "}
          24h aggregates from HL.
        </span>
        <span className="tnum">
          HTAO/USDC TERMINAL · {new Date(now).toISOString().replace("T", " ").slice(0, 19)} UTC
        </span>
      </footer>
    </main>
  );
}
