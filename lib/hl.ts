// ---------------------------------------------------------------------------
// Hyperliquid constants & types for the HTAO/USDC spot pair.
//
// Identity verified against the live API (spotMetaAndAssetCtxs):
//   - universe entry  : { name: "@307", index: 307, tokens: [452, 0] }
//   - token 452       : HTAO ("Hyper TAO"), szDecimals 2, weiDecimals 8
//   - token 0         : USDC (quote)
//   - asset ctx key   : ctx.coin === "@307"  (ctxs are matched by `coin`,
//                       NOT by positional index — the arrays are not aligned)
//
// HTAO is TAO bridged onto Hyperliquid via LayerZero, so it trades ~TAO price.
// ---------------------------------------------------------------------------

export const HL_INFO_URL = "https://api.hyperliquid.xyz/info";
export const HL_WS_URL = "wss://api.hyperliquid.xyz/ws";

/** Order-book / trades / candle subscription key for the spot pair. */
export const PAIR_COIN = "@307";
export const PAIR_NAME = "HTAO/USDC";
export const BASE_TOKEN = "HTAO";
export const QUOTE_TOKEN = "USDC";

/** HIP-1 token metadata for HTAO. */
export const HTAO_TOKEN_INDEX = 452;
export const HTAO_TOKEN_ID = "0x3958075da51fc7a18e390dc83bd71d87";
export const HTAO_EVM_CONTRACT = "0xdf23ab692d47c5d9b1445c8183a2dca4529a621f";
export const HTAO_SZ_DECIMALS = 2;
export const HTAO_WEI_DECIMALS = 8;

/**
 * MentatMinds' Hyperliquid (HyperCore) deposit address for HTAO + USDC.
 * Any trade with this address on one side is MM (our own market-making) flow.
 * Source: mm-market-making-hl/README.md.
 */
export const MM_ADDRESS = "0x11f9a5bd171bdb5f71126d59276072f4b76dcf00";

/** MentatMinds' volume bot address. Its flow is manufactured volume, not organic. */
export const VOL_BOT_ADDRESS = "0x54952f67751112c880bc1369181b0cbaa00f1f81";

export type TraderLabel = "MM" | "VOLBOT" | "ORGANIC";

/** Friendly names for known internal addresses. */
export const KNOWN_LABELS: Record<TraderLabel, string> = {
  MM: "Market Maker",
  VOLBOT: "Volume Bot",
  ORGANIC: "Organic",
};

export function labelFor(addr: string): TraderLabel {
  const a = addr.toLowerCase();
  if (a === MM_ADDRESS.toLowerCase()) return "MM";
  if (a === VOL_BOT_ADDRESS.toLowerCase()) return "VOLBOT";
  return "ORGANIC";
}

/** True if the address is one of our own bots (MM or volume bot). */
export function isOwnBot(addr: string): boolean {
  return labelFor(addr) !== "ORGANIC";
}

/** HL block explorer link for an address. */
export function explorerUrl(addr: string): string {
  return `https://app.hyperliquid.xyz/explorer/address/${addr}`;
}

// --- API response shapes ----------------------------------------------------

export interface SpotAssetCtx {
  coin: string;
  markPx: string;
  midPx: string | null;
  prevDayPx: string;
  dayNtlVlm: string; // 24h notional volume (USDC)
  dayBaseVlm: string; // 24h base volume (HTAO)
  circulatingSupply: string;
  totalSupply: string;
}

export interface Overview {
  pair: string;
  base: string;
  quote: string;
  mid: number | null;
  mark: number;
  prevDayPx: number;
  change24h: number; // absolute
  changePct24h: number;
  dayNtlVlm: number; // USDC
  dayBaseVlm: number; // HTAO
  circulatingSupply: number;
  totalSupply: number;
  marketCap: number; // circulating * mark
  fdv: number; // total * mark
  szDecimals: number;
  weiDecimals: number;
  tokenId: string;
  evmContract: string | null;
  ts: number;
}

export interface Candle {
  t: number; // open time ms
  T: number; // close time ms
  s?: string; // symbol (coin)
  i?: string; // interval
  o: string;
  c: string;
  h: string;
  l: string;
  v: string; // base volume
  n: number; // trade count
}

export interface BookLevel {
  px: string;
  sz: string;
  n: number; // number of orders at this level
}

export interface L2Book {
  coin: string;
  time: number;
  levels: [BookLevel[], BookLevel[]]; // [bids, asks]
}

/** A single public trade from the `trades` WS channel. */
export interface Trade {
  coin: string;
  side: "B" | "A"; // aggressor side: B = buy, A = sell
  px: string;
  sz: string;
  time: number;
  hash: string;
  tid: number;
  users: [string, string]; // [buyer, seller]
}

export interface BboLevel {
  px: string;
  sz: string;
  n: number;
}

/** A trade enriched for the UI. */
export interface UiTrade {
  tid: number;
  time: number;
  side: "B" | "A";
  px: number;
  sz: number;
  notional: number;
  buyer: string;
  seller: string;
  buyerLabel: TraderLabel;
  sellerLabel: TraderLabel;
  /** Single-bucket classification by precedence MM > VOLBOT > ORGANIC. */
  bucket: TraderLabel;
}

export const CANDLE_INTERVALS = [
  { label: "1m", value: "1m", days: 0.5 },
  { label: "5m", value: "5m", days: 1 },
  { label: "15m", value: "15m", days: 3 },
  { label: "1h", value: "1h", days: 7 },
  { label: "4h", value: "4h", days: 30 },
  { label: "1d", value: "1d", days: 180 },
] as const;

export type IntervalValue = (typeof CANDLE_INTERVALS)[number]["value"];
