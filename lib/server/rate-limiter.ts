/**
 * Development-safe in-memory rate limiting.
 *
 * Token-bucket per identifier (IP address today; swappable for a user id
 * once auth exists). This is intentionally process-local — fine for a
 * single dev/staging instance, but it will NOT coordinate across multiple
 * server instances in a real production deployment. When that matters,
 * swap the module-level Map below for Redis/Upstash: `checkRateLimit`'s
 * signature and every call site stay exactly the same.
 */

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

const MAX_TOKENS = 10;
const REFILL_WINDOW_MS = 60_000; // 10 requests per rolling 60s window

const buckets = new Map<string, Bucket>();

export function checkRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(identifier);

  if (!existing) {
    buckets.set(identifier, { tokens: MAX_TOKENS - 1, lastRefillMs: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  const elapsed = now - existing.lastRefillMs;
  const refillCount = Math.floor((elapsed / REFILL_WINDOW_MS) * MAX_TOKENS);
  if (refillCount > 0) {
    existing.tokens = Math.min(MAX_TOKENS, existing.tokens + refillCount);
    existing.lastRefillMs = now;
  }

  if (existing.tokens > 0) {
    existing.tokens -= 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  const msPerToken = REFILL_WINDOW_MS / MAX_TOKENS;
  return { allowed: false, retryAfterMs: Math.ceil(msPerToken) };
}

/** Best-effort client identifier for anonymous rate limiting. */
export function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}
