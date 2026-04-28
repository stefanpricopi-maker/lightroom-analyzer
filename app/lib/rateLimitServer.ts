import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import {
  buildRateLimitHeaders,
  checkRateLimit,
  type RateLimitConfig,
  type RateLimitResult,
} from "@/app/lib/rateLimit";

function hasUpstashEnv(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

type UpstashDuration = Parameters<typeof Ratelimit.slidingWindow>[1];

function toUpstashWindow(windowMs: number): UpstashDuration {
  // Keep it simple and predictable: we only emit seconds here.
  const seconds = Math.max(1, Math.ceil(Math.max(1, windowMs) / 1000));
  return `${seconds} s` as UpstashDuration;
}

// Cache limiters per config so we don't construct them on every request.
const limiterCache = new Map<string, Ratelimit>();

function getUpstashLimiter(config: RateLimitConfig): Ratelimit {
  const key = `${config.maxRequests}:${config.windowMs}`;
  const existing = limiterCache.get(key);
  if (existing) return existing;

  const redis = Redis.fromEnv();
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.maxRequests, toUpstashWindow(config.windowMs)),
    analytics: true,
    prefix: "lr-analyzer:ratelimit",
  });

  limiterCache.set(key, limiter);
  return limiter;
}

function mapUpstashToResult(now: number, r: { success: boolean; remaining: number; reset: number }): RateLimitResult {
  if (r.success) {
    return {
      allowed: true,
      remaining: Math.max(0, r.remaining),
      resetAt: r.reset,
    };
  }

  const retryAfterMs = Math.max(0, r.reset - now);
  const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return {
    allowed: false,
    remaining: 0,
    resetAt: r.reset,
    retryAfter,
  };
}

/**
 * Shared-store (Upstash) rate limit check for API routes.
 * Falls back to the in-memory limiter when Upstash env is missing.
 */
export async function checkRateLimitServer(
  identifier: string,
  config: RateLimitConfig
): Promise<{ result: RateLimitResult; headers: Record<string, string> }> {
  if (!hasUpstashEnv()) {
    const result = checkRateLimit(identifier, config);
    return { result, headers: buildRateLimitHeaders(config, result) };
  }

  const now = Date.now();
  const limiter = getUpstashLimiter(config);
  const r = await limiter.limit(identifier);

  const result = mapUpstashToResult(now, {
    success: r.success,
    remaining: r.remaining,
    reset: r.reset,
  });

  return { result, headers: buildRateLimitHeaders(config, result) };
}

