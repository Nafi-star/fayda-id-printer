import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import { ensureSchema as ensureJobsSchema } from "@/lib/db";

let authSchemaInitialized = false;

export async function ensureAuthSchema() {
  if (authSchemaInitialized) return;

  // Make sure jobs table exists as well (shared DB).
  await ensureJobsSchema();

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  authSchemaInitialized = true;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function registerUser(email: string, password: string) {
  await ensureAuthSchema();

  const normalized = normalizeEmail(email);
  const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [normalized]);
  if (existing.rows.length > 0) {
    return { ok: false as const, message: "Email already in use." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = cryptoRandomId();

  await db.query(
    `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
    [userId, normalized, passwordHash],
  );

  return { ok: true as const, userId };
}

export async function loginUser(email: string, password: string) {
  await ensureAuthSchema();

  const normalized = normalizeEmail(email);
  const result = await db.query(
    `SELECT id, password_hash FROM users WHERE email = $1`,
    [normalized],
  );

  const user = result.rows[0] as { id: string; password_hash: string } | undefined;
  if (!user) return { ok: false as const, message: "Invalid email or password." };

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return { ok: false as const, message: "Invalid email or password." };

  const sessionToken = cryptoRandomSessionToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  await db.query(
    `INSERT INTO sessions (session_token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sessionToken, user.id, expiresAt.toISOString()],
  );

  return { ok: true as const, userId: user.id, sessionToken };
}

export async function getUserFromSession(sessionToken: string | undefined | null) {
  if (!sessionToken) return null;

  await ensureAuthSchema();

  const result = await db.query(
    `
      SELECT u.id, u.email
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.session_token = $1
        AND s.expires_at > NOW()
    `,
    [sessionToken],
  );

  return result.rows[0] ? (result.rows[0] as { id: string; email: string }) : null;
}

export async function createPasswordReset(email: string) {
  await ensureAuthSchema();

  const normalized = normalizeEmail(email);
  const result = await db.query(`SELECT id FROM users WHERE email = $1`, [normalized]);
  const user = result.rows[0] as { id: string } | undefined;

  // Do not reveal whether email exists.
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min

  if (!user) {
    return { ok: true as const, tokenForDebug: rawToken };
  }

  const tokenHash = rawToken; // v1: token-as-hash; replace with SHA256 later

  await db.query(
    `INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
    [tokenHash, user.id, expiresAt.toISOString()],
  );

  return { ok: true as const, tokenForDebug: rawToken };
}

export async function resetPassword(token: string, newPassword: string) {
  await ensureAuthSchema();

  const result = await db.query(
    `
      SELECT user_id
      FROM password_resets
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > NOW()
    `,
    [token],
  );

  const row = result.rows[0] as { user_id: string } | undefined;
  if (!row) return { ok: false as const, message: "Invalid or expired reset token." };

  const newHash = await bcrypt.hash(newPassword, 12);

  await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, row.user_id]);
  await db.query(`UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND token_hash = $2`, [row.user_id, token]);

  return { ok: true as const };
}

function cryptoRandomId() {
  // Keep it simple: 16 bytes -> base64url.
  return randomBytes(16).toString("base64url");
}

function cryptoRandomSessionToken() {
  return randomBytes(32).toString("base64url");
}

