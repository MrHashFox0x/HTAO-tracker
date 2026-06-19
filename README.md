# HTAO/USDC — Hyperliquid Terminal

Real-time market intelligence dashboard for the **HTAO/USDC** spot pair on
[Hyperliquid](https://hyperliquid.xyz) (`@307`). Terminal/hacker aesthetic,
built to be deployed on Vercel in one click.

HTAO is Bittensor TAO bridged to Hyperliquid via LayerZero, market-made by
MentatMinds (delta-neutral, hedged on MEXC).

## What it tracks

Everything the public Hyperliquid API exposes for the pair:

- **Live price** — mid / mark, 24h change, prev close, BBO via WebSocket
- **24h stats** — notional volume (USDC), base volume (HTAO), trade count, high/low
- **Market structure** — market cap, FDV, circulating / total supply
- **Candlestick + volume chart** — 1m → 1d intervals (TradingView lightweight-charts)
- **Order book** — full L2 depth, cumulative size bars, spread (bps), mid
- **Live trade tape** — every fill with price, size, notional, taker address, MM tag
- **Traders** — unique trader count + leaderboard by volume (session)
- **Order flow** — buy/sell pressure, cumulative delta, trade counts
- **MM participation** — % of flow that is MentatMinds vs organic (tags the MM
  HyperCore address `0x11f9a5…dcf00`)
- **Asset reference** — token index/id, EVM contract, decimals

> Trader / flow metrics have two modes: **SESSION** (live WS + per-browser
> localStorage, works with zero backend) and **ALL-TIME** (served from a
> Postgres store fed 24/7 by the collector — see *All-time activity store*
> below). 24h aggregates always come from HL's asset context / candles.

## Architecture

- **Next.js 14 (App Router) + TypeScript + Tailwind** — deployed on Vercel.
- The browser connects **directly** to `wss://api.hyperliquid.xyz/ws` for all
  live data (price/ctx, `l2Book`, `bbo`, `trades`, `candle`) — auto-reconnect
  with backoff, 30s ping. Only `/api/hl/candles` proxies `/info` for chart
  history (WS streams only the forming candle).
- **Optional all-time store** (Postgres + `/api/stats/*`) — see below. The
  dashboard works with or without it; without a `DATABASE_URL` it falls back to
  live WS + per-browser localStorage aggregation.

## All-time activity store (browser-fed → Postgres)

Hyperliquid has **no historical-trades REST endpoint**, so the only way to build
an all-time view of who traded the pair is to record trades as they happen. The
dashboard does this itself: while a tab is open, the live WS feeds every new
trade to `POST /api/stats/ingest`, which classifies it (MM / volume bot /
organic) and upserts it into Postgres (dedup by `tid`). The read-routes
(`/api/stats/overview`, `/api/stats/trades`) serve the accumulated all-time
flow, leaderboard, and tape, which the page polls every 10s.

So the store grows **whenever any tab is open** — keep one open and it's a
recorder. The only gaps are windows where no tab is open anywhere (those trades
can't be recovered). The ingest route creates its own table on first write, so
setup is just: point a Postgres at it.

### Setup (Supabase, ~2 min)

1. Create a Supabase project; grab the **transaction pooler** connection string
   (port `6543`).
2. Add it as `DATABASE_URL` in the Vercel project env, redeploy.

That's it. Open the dashboard and trades start landing in `trades`; the
TRADERS / ORDER FLOW panels flip to **ALL-TIME** (toggle to **SESSION** for this
browser's live view). Optionally set `INGEST_TOKEN` (server) +
`NEXT_PUBLIC_INGEST_TOKEN` (client) to gate writes — note the client token ships
to the browser, so it's a speed bump, not real auth.

> `/collector` holds a standalone Node script that does the same ingest from an
> always-on host (24/7, no open tab needed) if you ever want gap-free capture.
> Not required for the browser-fed setup above. `db/schema.sql` is the canonical
> schema for manual setup.

No API keys. The HL data is read-only public; only your own Postgres URL is secret.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

## Deploy to Vercel

```bash
npm i -g vercel    # if needed
vercel             # follow prompts, accept defaults
vercel --prod
```

Or push to GitHub and "Import Project" on vercel.com — framework auto-detected
as Next.js, zero config.

## Pair identity (verified against the live API)

| Field | Value |
|---|---|
| Spot universe name | `@307` (spotMeta index 307) |
| Tokens | `[452 HTAO, 0 USDC]` |
| HTAO token id | `0x3958075da51fc7a18e390dc83bd71d87` |
| HTAO EVM contract | `0xdf23ab692d47c5d9b1445c8183a2dca4529a621f` |
| szDecimals / weiDecimals | 2 / 8 |

> Note: in `spotMetaAndAssetCtxs` the asset-context array is **not** positionally
> aligned with the universe — contexts are matched by `ctx.coin === "@307"`.

## Security note

`npm audit` flags the Next.js 14.2.x line for several advisories (DoS via image
optimizer, middleware cache-poisoning, RSC request smuggling). None apply here:
no `next/image`, no middleware, no rewrites/i18n, and the only server surface is
three read-only GET proxies. Deployed on Vercel, the platform also patches infra.
To clear the audit entirely you can bump to the latest Next major (`npm i next@latest`),
which on this codebase only requires React 19.
