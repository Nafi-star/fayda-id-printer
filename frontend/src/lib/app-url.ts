/**
 * Public site URL for links in emails (password reset, etc.).
 * Set APP_URL in production (e.g. https://yourdomain.com).
 */
export function getAppBaseUrl(): string {
  const explicit = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://127.0.0.1:3000";
}
