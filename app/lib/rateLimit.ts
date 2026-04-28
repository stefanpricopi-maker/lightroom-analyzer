// NOTE: In-memory rate limiting resets on Vercel cold starts and is per-isolate.
// For higher-traffic production, prefer a shared store (e.g. Redis / Upstash) so limits are global.

import type { NextRequest } from "next/server";

export interface RateLimitConfig {
  windowMs: number; // time window in ms
  maxRequests: number; // max requests per window per IP
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // timestamp ms
  retryAfter?: number; // seconds until reset
}

export function buildRateLimitHeaders(
  config: RateLimitConfig,
  result: RateLimitResult
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(config.maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };
  if (typeof result.retryAfter === "number") {
    headers["Retry-After"] = String(result.retryAfter);
  }
  return headers;
}

type Bucket = {
  timestamps: number[];
  lastSeen: number; // ms
};

const buckets = new Map<string, Bucket>();
let maxWindowMsSeen = 0;
let lastGcAt = 0;

// exported for testing only — do not use in production
export function resetForTesting(): void {
  buckets.clear();
  maxWindowMsSeen = 0;
  lastGcAt = 0;
}

function pruneWindowInPlace(timestamps: number[], now: number, windowMs: number) {
  const cutoff = now - windowMs;
  let i = 0;
  while (i < timestamps.length && timestamps[i] < cutoff) i++;
  if (i > 0) timestamps.splice(0, i);
}

export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  // NextRequest may expose ip on some deployments; keep as a best-effort fallback.
  const anyReq = request as unknown as { ip?: string };
  if (typeof anyReq.ip === "string" && anyReq.ip.trim()) return anyReq.ip.trim();

  return "unknown";
}

export function checkRateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = Math.max(1, config.windowMs);
  maxWindowMsSeen = Math.max(maxWindowMsSeen, windowMs);

  // Opportunistic GC: remove long-inactive IP buckets to cap memory growth.
  // We GC at most once per max-window interval.
  if (maxWindowMsSeen > 0 && now - lastGcAt > maxWindowMsSeen) {
    const cutoff = now - maxWindowMsSeen * 2;
    for (const [key, bucket] of buckets) {
      if (bucket.lastSeen < cutoff) buckets.delete(key);
    }
    lastGcAt = now;
  }

  const existing = buckets.get(ip);
  const bucket: Bucket = existing ?? { timestamps: [], lastSeen: now };
  bucket.lastSeen = now;
  pruneWindowInPlace(bucket.timestamps, now, windowMs);

  if (config.maxRequests <= 0) {
    // No requests allowed; don't keep state.
    if (!existing) buckets.delete(ip);
    return {
      allowed: false,
      remaining: 0,
      resetAt: now,
      retryAfter: 1,
    };
  }

  if (bucket.timestamps.length >= config.maxRequests) {
    const oldest = bucket.timestamps[0]!;
    const resetAt = oldest + windowMs;
    const retryAfterMs = Math.max(0, resetAt - now);
    const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter,
    };
  }

  bucket.timestamps.push(now);
  buckets.set(ip, bucket);

  const resetAt = now + windowMs;
  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - bucket.timestamps.length),
    resetAt,
  };
}
