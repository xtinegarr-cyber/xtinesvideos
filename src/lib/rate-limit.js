// Simple in-memory limiter. Enough for one server; it resets on restart.
const buckets = globalThis.__xvRateLimits ?? (globalThis.__xvRateLimits = new Map());

/** Returns true if this key is still under `limit` attempts per window. */
export function allow(key, limit = 8, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
