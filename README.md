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
- **Optional all-time store** (`/collector` + Postgres + `/api/stats/*`) — see
  below. The dashboard works with or without it; without a `DATABASE_URL` it
  falls back to live WS + per-browser localStorage aggregation.

## All-time activity store (collector → Postgres)

Hyperliquid has **no historical-trades REST endpoint**, so the only way to get
an all-time view of who traded the pair is to record every trade as it happens.
Vercel is serverless — no always-on process — so this splits in three:

1. **`/collector`** — a standalone Node process that holds the HL `trades` WS
   open 24/7 and writes every fill into Postgres (dedup by `tid`), plus a
   price/volume/supply snapshot each minute. **Must run on an always-on host**
   (Railway / Fly / a VPS / a box at home) — *not* on Vercel.
2. **Postgres** — source of truth. Universal via `DATABASE_URL` (Supabase, Neon,
   Vercel Postgres, or self-hosted). Schema in `db/schema.sql` (the collector
   also applies it on boot).
3. **`/api/stats/*`** — read-routes the dashboard polls (every 10s) for all-time
   flow, leaderboard, and tape scrollback. Set the same `DATABASE_URL` in Vercel.

"All-time" means **since the collector first ran** — deploy it once and leave it
up. The dashboard's **VIEW: ALL-TIME / SESSION** toggle switches between the DB
view and this browser's live session.

### Deploy the collector

```bash
# any always-on host — point it at your POOLED Postgres URL:
cd collector
cp .env.example .env        # set DATABASE_URL (Supabase :6543 / Neon -pooler)
npm install
npm start
```

Or Docker (build context = repo root):

```bash
docker build -f collector/Dockerfile -t htao-collector .
docker run -d --restart=always -e DATABASE_URL=postgres://... htao-collector
```

Then add the same `DATABASE_URL` to the Vercel project's env vars and redeploy —
the dashboard switches to all-time automatically once the table has rows.

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
