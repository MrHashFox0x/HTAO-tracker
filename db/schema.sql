-- ---------------------------------------------------------------------------
-- HTAO-tracker — all-time activity store (Postgres)
--
-- Source of truth for every trade on the HTAO/USDC (@307) spot pair on
-- Hyperliquid. Written 24/7 by the standalone collector (../collector), read
-- by the Vercel dashboard via /api/stats/*.
--
-- This file is the canonical schema; the collector applies an identical inline
-- mirror on boot, so manual setup here is optional. Idempotent — safe to rerun.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trades (
  tid           BIGINT           PRIMARY KEY,        -- HL trade id (dedup key)
  coin          TEXT             NOT NULL,           -- "@307"
  ts            BIGINT           NOT NULL,           -- trade time, ms epoch
  side          CHAR(1)          NOT NULL,           -- 'B' = buy aggressor, 'A' = sell aggressor
  px            DOUBLE PRECISION NOT NULL,
  sz            DOUBLE PRECISION NOT NULL,           -- base size (HTAO)
  notional      DOUBLE PRECISION NOT NULL,           -- px * sz (USDC)
  buyer         TEXT             NOT NULL,
  seller        TEXT             NOT NULL,
  buyer_label   TEXT             NOT NULL,           -- MM | VOLBOT | ORGANIC
  seller_label  TEXT             NOT NULL,
  bucket        TEXT             NOT NULL,           -- single-bucket: MM > VOLBOT > ORGANIC
  hash          TEXT,
  ingested_at   TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trades_ts_idx     ON trades (ts DESC);
CREATE INDEX IF NOT EXISTS trades_buyer_idx  ON trades (buyer);
CREATE INDEX IF NOT EXISTS trades_seller_idx ON trades (seller);
CREATE INDEX IF NOT EXISTS trades_bucket_idx ON trades (bucket);

-- Periodic market snapshots (price + rolling 24h volume + supply) so we can
-- reconstruct an all-time volume / price history independent of candles.
CREATE TABLE IF NOT EXISTS market_snapshots (
  ts            BIGINT           PRIMARY KEY,        -- snapshot time, ms epoch
  mark          DOUBLE PRECISION,
  mid           DOUBLE PRECISION,
  prev_day_px   DOUBLE PRECISION,
  day_ntl_vlm   DOUBLE PRECISION,
  day_base_vlm  DOUBLE PRECISION,
  circ_supply   DOUBLE PRECISION,
  total_supply  DOUBLE PRECISION
);
