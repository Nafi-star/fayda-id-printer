function normalize(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Primary admin addresses — edit here. These always have admin access, even if
 * ADMIN_EMAIL / ADMIN_EMAILS in the environment point at a different address.
 * Optional env vars add extra admins (e.g. co-owners), they do not replace this list.
 */
const ADMIN_EMAILS_FROM_CONFIG = ["admingule12@gmail.com"];

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

function parseEnvAdminEmails(): string[] {
  const raw = rawAdminListFromEnv();
  if (!raw) return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalize);
}

export function normalizedAdminEmails(): string[] {
  const fromConfig = ADMIN_EMAILS_FROM_CONFIG.map(normalize).filter(Boolean);
  const fromEnv = parseEnvAdminEmails();
  return [...new Set([...fromConfig, ...fromEnv])];
}

/** First admin (e.g. primary contact): config first, then env extras. */
export function normalizedAdminEmail(): string {
  const all = normalizedAdminEmails();
  return all[0] ?? "";
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
