function normalize(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Used only when neither ADMIN_EMAIL nor ADMIN_EMAILS is set.
 * Buyers should set ADMIN_EMAIL or ADMIN_EMAILS in production (Vercel / .env).
 */
const DEFAULT_ADMIN_EMAIL = "dani745@gmail.com";

/**
 * Comma, semicolon, or newline separated list in ADMIN_EMAILS,
 * or a single address in ADMIN_EMAIL. ADMIN_EMAILS wins if both are set.
 * Example: ADMIN_EMAILS=owner@biz.com,support@biz.com
 */
function rawAdminListFromEnv(): string {
  const multi = process.env.ADMIN_EMAILS?.trim();
  if (multi) return multi;
  return process.env.ADMIN_EMAIL?.trim() || "";
}

export function normalizedAdminEmails(): string[] {
  const raw = rawAdminListFromEnv();
  if (!raw) return [normalize(DEFAULT_ADMIN_EMAIL)];
  const parts = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return [normalize(DEFAULT_ADMIN_EMAIL)];
  const normalized = parts.map(normalize);
  return [...new Set(normalized)];
}

/** First admin (e.g. primary contact). Prefer normalizedAdminEmails() for checks. */
export function normalizedAdminEmail(): string {
  const all = normalizedAdminEmails();
  return all[0] ?? normalize(DEFAULT_ADMIN_EMAIL);
}

export function isAdminEmail(email: string): boolean {
  const n = normalize(email);
  return normalizedAdminEmails().includes(n);
}

/**
 * When true, new registrations (except listed admin emails) stay pending until approved in /admin.
 * Set DISABLE_ADMIN_APPROVAL=true for open sign-up (e.g. local dev).
 */
export function adminApprovalEnabled(): boolean {
  const off = (process.env.DISABLE_ADMIN_APPROVAL ?? "").trim().toLowerCase();
  if (off === "true" || off === "1" || off === "yes") return false;
  return true;
}
