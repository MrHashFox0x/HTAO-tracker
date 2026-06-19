import { Pool } from "pg";

// ---------------------------------------------------------------------------
// Postgres pool for the Vercel API read-routes (/api/stats/*).
//
// The pool is a module singleton stashed on globalThis so it survives the hot
// reload / lambda warm-reuse that Next does in dev and on Vercel. If no
// DATABASE_URL is set, the dashboard simply falls back to its live/localStorage
// session view — the DB layer is entirely optional.
//
// Use the POOLED connection string from your provider (Supabase :6543,
// Neon "-pooler" host, Vercel Postgres POSTGRES_URL) — serverless opens many
// short-lived clients and will exhaust a direct connection otherwise.
// ---------------------------------------------------------------------------

const CONN = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

export const DB_CONFIGURED = CONN.length > 0;

declare global {
  // eslint-disable-next-line no-var
  var _htaoPool: Pool | undefined;
}

export function getPool(): Pool | null {
  if (!DB_CONFIGURED) return null;
  if (!global._htaoPool) {
    global._htaoPool = new Pool({
      connectionString: CONN,
      ssl: process.env.PGSSL === "disable" ? undefined : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    global._htaoPool.on("error", () => {
      /* swallow idle-client errors; next query reconnects */
    });
  }
  return global._htaoPool;
}
