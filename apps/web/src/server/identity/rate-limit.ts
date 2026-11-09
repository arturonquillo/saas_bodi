import { ApiError } from "../http/respond";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function assertRateLimit(key: string, limit = 20, windowMs = 60_000) {
  if (!rateLimit(key, limit, windowMs)) {
    throw new ApiError("rate_limit", "Muitas tentativas. Tente novamente em instantes.");
  }
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
