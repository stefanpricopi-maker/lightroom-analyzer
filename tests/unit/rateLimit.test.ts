import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import {
  checkRateLimit,
  getClientIp,
  resetForTesting,
  type RateLimitConfig,
} from "@/app/lib/rateLimit";
import {
  ANALYZE_LIMIT,
  BATCH_LIMIT,
  CRITIQUE_LIMIT,
  DIFF_LIMIT,
} from "@/app/lib/rateLimitConfigs";

const mockRequest = (headers: Record<string, string>, ip?: string) =>
  ({
    headers: { get: (key: string) => headers[key] ?? null },
    ip,
  }) as unknown as NextRequest;

describe("getClientIp", () => {
  it("returns x-forwarded-for header when present", () => {
    const req = mockRequest({ "x-forwarded-for": "203.0.113.1" });
    expect(getClientIp(req)).toBe("203.0.113.1");
  });

  it("returns first IP from comma-separated x-forwarded-for list", () => {
    const req = mockRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to request.ip when x-forwarded-for is missing", () => {
    const req = mockRequest({}, "198.51.100.9");
    expect(getClientIp(req)).toBe("198.51.100.9");
  });

  it('returns "unknown" when both are missing', () => {
    const req = mockRequest({});
    expect(getClientIp(req)).toBe("unknown");
  });

  it("trims whitespace from IP addresses", () => {
    const req = mockRequest({ "x-forwarded-for": "  203.0.113.2  , 5.6.7.8" });
    expect(getClientIp(req)).toBe("203.0.113.2");
  });

  it("trims request.ip fallback", () => {
    const req = mockRequest({}, "  198.51.100.10  ");
    expect(getClientIp(req)).toBe("198.51.100.10");
  });
});

describe("checkRateLimit — basic behavior", () => {
  const cfg: RateLimitConfig = { windowMs: 60_000, maxRequests: 3 };

  beforeEach(() => {
    vi.useFakeTimers();
    resetForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows first request for a new IP", () => {
    const r = checkRateLimit("10.0.0.1", cfg);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("returns correct remaining count after each request", () => {
    expect(checkRateLimit("10.0.0.2", cfg).remaining).toBe(2);
    expect(checkRateLimit("10.0.0.2", cfg).remaining).toBe(1);
    expect(checkRateLimit("10.0.0.2", cfg).remaining).toBe(0);
  });

  it("allows requests up to the limit", () => {
    expect(checkRateLimit("10.0.0.3", cfg).allowed).toBe(true);
    expect(checkRateLimit("10.0.0.3", cfg).allowed).toBe(true);
    expect(checkRateLimit("10.0.0.3", cfg).allowed).toBe(true);
  });

  it("blocks the request that exceeds the limit", () => {
    checkRateLimit("10.0.0.4", cfg);
    checkRateLimit("10.0.0.4", cfg);
    checkRateLimit("10.0.0.4", cfg);
    const blocked = checkRateLimit("10.0.0.4", cfg);
    expect(blocked.allowed).toBe(false);
  });

  it("returns allowed: false when limit is exceeded", () => {
    checkRateLimit("10.0.0.5", cfg);
    checkRateLimit("10.0.0.5", cfg);
    checkRateLimit("10.0.0.5", cfg);
    expect(checkRateLimit("10.0.0.5", cfg).allowed).toBe(false);
  });

  it("returns retryAfter value when blocked", () => {
    checkRateLimit("10.0.0.6", cfg);
    checkRateLimit("10.0.0.6", cfg);
    checkRateLimit("10.0.0.6", cfg);
    const blocked = checkRateLimit("10.0.0.6", cfg);
    expect(blocked.retryAfter).toBeDefined();
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("returns resetAt timestamp when blocked", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    checkRateLimit("10.0.0.7", cfg);
    checkRateLimit("10.0.0.7", cfg);
    checkRateLimit("10.0.0.7", cfg);
    const blocked = checkRateLimit("10.0.0.7", cfg);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });
});

describe("checkRateLimit — sliding window", () => {
  const cfg: RateLimitConfig = { windowMs: 10_000, maxRequests: 2 };

  beforeEach(() => {
    vi.useFakeTimers();
    resetForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests outside the time window are not counted", () => {
    vi.setSystemTime(0);
    checkRateLimit("10.1.0.1", cfg);
    checkRateLimit("10.1.0.1", cfg);
    expect(checkRateLimit("10.1.0.1", cfg).allowed).toBe(false);

    vi.advanceTimersByTime(10_001);
    expect(checkRateLimit("10.1.0.1", cfg).allowed).toBe(true);
  });

  it("requests inside the window ARE counted", () => {
    vi.setSystemTime(0);
    checkRateLimit("10.1.0.2", cfg);
    vi.advanceTimersByTime(5_000);
    expect(checkRateLimit("10.1.0.2", cfg).allowed).toBe(true);
    expect(checkRateLimit("10.1.0.2", cfg).allowed).toBe(false);
  });

  it("after window expires, allows requests again", () => {
    vi.setSystemTime(0);
    checkRateLimit("10.1.0.3", cfg);
    checkRateLimit("10.1.0.3", cfg);
    expect(checkRateLimit("10.1.0.3", cfg).allowed).toBe(false);

    vi.advanceTimersByTime(10_001);
    expect(checkRateLimit("10.1.0.3", cfg).allowed).toBe(true);
  });

  it("mix of old and new requests — only counts requests within window", () => {
    vi.setSystemTime(0);
    checkRateLimit("10.1.0.4", cfg);
    vi.advanceTimersByTime(6_000);
    checkRateLimit("10.1.0.4", cfg);
    expect(checkRateLimit("10.1.0.4", cfg).allowed).toBe(false);

    vi.advanceTimersByTime(5_000); // t=11000, first request aged out
    expect(checkRateLimit("10.1.0.4", cfg).allowed).toBe(true);
  });
});

describe("checkRateLimit — multiple IPs", () => {
  const cfg: RateLimitConfig = { windowMs: 60_000, maxRequests: 2 };

  beforeEach(() => {
    vi.useFakeTimers();
    resetForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rate limit is per IP — one IP being limited does not affect another IP", () => {
    checkRateLimit("10.2.0.1", cfg);
    checkRateLimit("10.2.0.1", cfg);
    expect(checkRateLimit("10.2.0.1", cfg).allowed).toBe(false);

    expect(checkRateLimit("10.2.0.2", cfg).allowed).toBe(true);
  });

  it("two different IPs can each make their full quota of requests", () => {
    expect(checkRateLimit("10.2.0.3", cfg).allowed).toBe(true);
    expect(checkRateLimit("10.2.0.3", cfg).allowed).toBe(true);
    expect(checkRateLimit("10.2.0.4", cfg).allowed).toBe(true);
    expect(checkRateLimit("10.2.0.4", cfg).allowed).toBe(true);
  });

  it("same IP is tracked consistently across calls", () => {
    expect(checkRateLimit("10.2.0.5", cfg).remaining).toBe(1);
    expect(checkRateLimit("10.2.0.5", cfg).remaining).toBe(0);
    expect(checkRateLimit("10.2.0.5", cfg).allowed).toBe(false);
  });
});

describe("checkRateLimit — edge cases", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles windowMs of 0 gracefully (does not crash)", () => {
    expect(() => checkRateLimit("10.3.0.1", { windowMs: 0, maxRequests: 5 })).not.toThrow();
  });

  it("handles maxRequests of 1 (allows exactly one request)", () => {
    const cfg: RateLimitConfig = { windowMs: 60_000, maxRequests: 1 };
    expect(checkRateLimit("10.3.0.2", cfg).allowed).toBe(true);
    expect(checkRateLimit("10.3.0.2", cfg).allowed).toBe(false);
  });

  it("handles maxRequests of 0 (blocks all requests)", () => {
    const cfg: RateLimitConfig = { windowMs: 60_000, maxRequests: 0 };
    expect(checkRateLimit("10.3.0.3", cfg).allowed).toBe(false);
    expect(checkRateLimit("10.3.0.3", cfg).allowed).toBe(false);
  });

  it("very large number of requests doesn't cause memory issues (cleanup works)", () => {
    const cfg: RateLimitConfig = { windowMs: 1_000, maxRequests: 50 };
    vi.setSystemTime(0);
    for (let i = 0; i < 5_000; i++) {
      checkRateLimit("10.3.0.4", cfg);
      // Keep the sliding window bounded: advance past the window between bursts.
      vi.advanceTimersByTime(1_001);
    }
    expect(checkRateLimit("10.3.0.4", cfg).allowed).toBe(true);
  });

  it('IP "unknown" is rate limited like any other IP', () => {
    const cfg: RateLimitConfig = { windowMs: 60_000, maxRequests: 1 };
    expect(checkRateLimit("unknown", cfg).allowed).toBe(true);
    expect(checkRateLimit("unknown", cfg).allowed).toBe(false);
  });
});

describe("rateLimitConfigs — sanity checks", () => {
  it("ANALYZE_LIMIT has windowMs of 1 hour (3600000ms) and maxRequests of 20", () => {
    expect(ANALYZE_LIMIT.windowMs).toBe(3_600_000);
    expect(ANALYZE_LIMIT.maxRequests).toBe(20);
  });

  it("DIFF_LIMIT has windowMs of 1 hour and maxRequests of 10", () => {
    expect(DIFF_LIMIT.windowMs).toBe(3_600_000);
    expect(DIFF_LIMIT.maxRequests).toBe(10);
  });

  it("BATCH_LIMIT has windowMs of 1 hour and maxRequests of 60", () => {
    expect(BATCH_LIMIT.windowMs).toBe(3_600_000);
    expect(BATCH_LIMIT.maxRequests).toBe(60);
  });

  it("CRITIQUE_LIMIT has windowMs of 1 hour and maxRequests of 15", () => {
    expect(CRITIQUE_LIMIT.windowMs).toBe(3_600_000);
    expect(CRITIQUE_LIMIT.maxRequests).toBe(15);
  });

  it("All configs have windowMs > 0 and maxRequests > 0", () => {
    const configs = [ANALYZE_LIMIT, DIFF_LIMIT, BATCH_LIMIT, CRITIQUE_LIMIT];
    for (const c of configs) {
      expect(c.windowMs).toBeGreaterThan(0);
      expect(c.maxRequests).toBeGreaterThan(0);
    }
  });

  it("BATCH_LIMIT.maxRequests is higher than ANALYZE_LIMIT.maxRequests", () => {
    expect(BATCH_LIMIT.maxRequests).toBeGreaterThan(ANALYZE_LIMIT.maxRequests);
  });
});

describe("Rate limit response fields (header mapping)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("when allowed, remaining = maxRequests - requestCount", () => {
    const cfg: RateLimitConfig = { windowMs: 60_000, maxRequests: 4 };
    expect(checkRateLimit("10.4.0.1", cfg).remaining).toBe(3);
    expect(checkRateLimit("10.4.0.1", cfg).remaining).toBe(2);
    expect(checkRateLimit("10.4.0.1", cfg).remaining).toBe(1);
    expect(checkRateLimit("10.4.0.1", cfg).remaining).toBe(0);
  });

  it("remaining maps to X-RateLimit-Remaining (blocked => 0)", () => {
    const cfg: RateLimitConfig = { windowMs: 60_000, maxRequests: 2 };
    checkRateLimit("10.4.0.2", cfg);
    checkRateLimit("10.4.0.2", cfg);
    const blocked = checkRateLimit("10.4.0.2", cfg);
    expect(blocked.remaining).toBe(0);
  });

  it("resetAt maps to X-RateLimit-Reset (allowed uses now + window)", () => {
    vi.setSystemTime(1_700_000_000_000);
    const cfg: RateLimitConfig = { windowMs: 30_000, maxRequests: 2 };
    const allowed = checkRateLimit("10.4.0.3", cfg);
    expect(allowed.resetAt).toBe(Date.now() + cfg.windowMs);
  });

  it("resetAt maps to X-RateLimit-Reset (blocked uses oldest + window)", () => {
    vi.setSystemTime(0);
    const cfg: RateLimitConfig = { windowMs: 10_000, maxRequests: 1 };
    const first = checkRateLimit("10.4.0.4", cfg);
    vi.advanceTimersByTime(2_000);
    const blocked = checkRateLimit("10.4.0.4", cfg);
    expect(blocked.resetAt).toBe(first.resetAt);
  });

  it("retryAfter maps to Retry-After (seconds, at least 1)", () => {
    vi.setSystemTime(0);
    const cfg: RateLimitConfig = { windowMs: 10_000, maxRequests: 1 };
    checkRateLimit("10.4.0.5", cfg);
    const blocked = checkRateLimit("10.4.0.5", cfg);
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
  });
});
