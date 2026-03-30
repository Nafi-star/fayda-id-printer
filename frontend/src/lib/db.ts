import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

export const db = new Pool({
  connectionString: databaseUrl,
});

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
      output_file_key TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_jobs_user_id_created_at
    ON jobs (user_id, created_at DESC);
  `);

  schemaInitialized = true;
}
