import { Pool, type QueryResult, type QueryResultRow } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });
  return pool;
}

/** Lazy pool so `next build` can run without DATABASE_URL until a route executes. */
export const db = {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<R>> {
    return getPool().query<R>(text, params);
  },
};

let schemaInitialized = false;

export async function ensureSchema() {
  if (schemaInitialized) {
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      input_file_key TEXT NOT NULL,
      input_file_keys TEXT,
      output_file_key TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Backward-compatible: older DBs won't have the column.
  await db.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS input_file_keys TEXT;`);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_jobs_user_id_created_at
    ON jobs (user_id, created_at DESC);
  `);

  schemaInitialized = true;
}
