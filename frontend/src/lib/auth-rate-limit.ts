type AttemptInfo = {
  count: number;
  windowStart: number;
  blockedUntil?: number;
};

const attempts = new Map<string, AttemptInfo>();

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000; // 15 minutes

export function checkAndTrackLoginRateLimit(key: string) {
  const now = Date.now();
  const prev = attempts.get(key);

  if (prev?.blockedUntil && prev.blockedUntil > now) {
    return { allowed: false as const, retryAfterSec: Math.ceil((prev.blockedUntil - now) / 1000) };
  }

  if (!prev || now - prev.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return { allowed: true as const, retryAfterSec: 0 };
  }

  prev.count += 1;
  if (prev.count > MAX_ATTEMPTS) {
    prev.blockedUntil = now + BLOCK_MS;
    attempts.set(key, prev);
    return { allowed: false as const, retryAfterSec: Math.ceil(BLOCK_MS / 1000) };
  }

  attempts.set(key, prev);
  return { allowed: true as const, retryAfterSec: 0 };
}

export function clearLoginRateLimit(key: string) {
  attempts.delete(key);
}

