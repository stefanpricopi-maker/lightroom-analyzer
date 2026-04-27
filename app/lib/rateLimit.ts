// NOTE: In-memory rate limiting resets on Vercel cold starts and is per-isolate.
// For higher-traffic production, prefer a shared store (e.g. Redis / Upstash) so limits are global.

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

const buckets = new Map<string, number[]>();

function pruneWindow(timestamps: number[], now: number, windowMs: number) {
  const cutoff = now - windowMs;
  let i = 0;
  while (i < timestamps.length && timestamps[i] < cutoff) i++;
  if (i === 0) return timestamps;
  return timestamps.slice(i);
}

export function checkRateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const prev = buckets.get(ip) ?? [];
  const windowed = pruneWindow(prev, now, config.windowMs);

  if (windowed.length >= config.maxRequests) {
    const oldest = windowed[0]!;
    const resetAt = oldest + config.windowMs;
    const retryAfterMs = Math.max(0, resetAt - now);
    const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter,
    };
  }

  const next = [...windowed, now];
  buckets.set(ip, next);

  const resetAt = now + config.windowMs;
  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - next.length),
    resetAt,
  };
}

export { getClientIp } from "@/app/lib/rateLimitIp";
