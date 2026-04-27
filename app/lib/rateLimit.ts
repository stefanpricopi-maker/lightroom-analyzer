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

const buckets = new Map<string, number[]>();

// exported for testing only — do not use in production
export function resetForTesting(): void {
  buckets.clear();
}

function pruneWindow(timestamps: number[], now: number, windowMs: number) {
  const cutoff = now - windowMs;
  let i = 0;
  while (i < timestamps.length && timestamps[i] < cutoff) i++;
  if (i === 0) return timestamps;
  return timestamps.slice(i);
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
  const prev = buckets.get(ip) ?? [];
  const windowed = pruneWindow(prev, now, windowMs);

  if (config.maxRequests <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: now,
      retryAfter: 1,
    };
  }

  if (windowed.length >= config.maxRequests) {
    const oldest = windowed[0]!;
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

  const next = [...windowed, now];
  buckets.set(ip, next);

  const resetAt = now + windowMs;
  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - next.length),
    resetAt,
  };
}
