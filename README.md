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

> Session metrics (flow, unique traders, MM share) accumulate from page load
> using the live WS tape — Hyperliquid has no public historical-trades REST
> endpoint, so per-trader history beyond the WS backfill isn't available.
> 24h aggregates come from HL's asset context / candles.

## Architecture

- **Next.js 14 (App Router) + TypeScript + Tailwind**
- Serverless route handlers (`/api/hl/*`) proxy Hyperliquid `/info` for the
  overview, candles, and order book — server-side cached (1.2–5s) to stay well
  under HL rate limits and avoid CORS.
- The browser connects **directly** to `wss://api.hyperliquid.xyz/ws` for the
  live `trades` + `bbo` feeds (auto-reconnect with backoff, 30s ping).

No API keys, no env vars, no backend state. Read-only public data.

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
