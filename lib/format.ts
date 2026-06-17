// Display formatters. All defensive against null / NaN so the terminal never
// renders "NaN" or "undefined".

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });

export function num(v: number | null | undefined, dp = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return nf(dp, dp).format(v);
}

export function price(v: number | null | undefined, dp = 4): string {
  if (v == null || !isFinite(v)) return "—";
  return nf(2, dp).format(v);
}

export function usd(v: number | null | undefined, dp = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return "$" + nf(dp, dp).format(v);
}

/** Compact USD: $1.24M, $12.3K, $943. */
export function usdCompact(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(2)}K`;
  return `${s}$${a.toFixed(2)}`;
}

/**
 * Precision-first USD: full grouped number with cents under $1M, compact above.
 * Keeps exact figures on a thin pair while staying readable if volume scales up.
 */
export function usdSmart(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 1e6) return usdCompact(v);
  return usd(v, 2);
}

export function compact(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(2)}K`;
  return `${s}${a.toFixed(2)}`;
}

export function pct(v: number | null | undefined, dp = 2): string {
  if (v == null || !isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(dp)}%`;
}

export function signed(v: number | null | undefined, dp = 2): string {
  if (v == null || !isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${nf(dp, dp).format(v)}`;
}

export function truncAddr(a: string | null | undefined): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function timeHMS(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function utcClock(ms: number): string {
  const d = new Date(ms);
  return (
    d
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d+Z$/, "") + " UTC"
  );
}

/** Relative "12s", "3m", "1h" age. */
export function ago(ms: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
