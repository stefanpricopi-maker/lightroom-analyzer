import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

import { resetForTesting, checkRateLimit } from "@/app/lib/rateLimit";
import { ANALYZE_LIMIT, DIFF_LIMIT } from "@/app/lib/rateLimitConfigs";

import { POST as analyzePOST, OPTIONS as analyzeOPTIONS } from "@/app/api/analyze/route";
import { POST as diffPOST, OPTIONS as diffOPTIONS } from "@/app/api/diff/route";

const mockReq = (url: string, headers: Record<string, string> = {}) =>
  ({
    url,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null },
    json: async () => ({}),
  }) as unknown as NextRequest;

describe("API security — CORS + rate limit headers", () => {
  beforeEach(() => {
    resetForTesting();
    vi.unstubAllEnvs();
    delete process.env.LR_ANALYZER_ALLOWED_ORIGIN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("OPTIONS returns 204 with CORS headers (same-origin)", async () => {
    const req = mockReq("https://app.example.com/api/analyze", {
      origin: "https://app.example.com",
    });
    const res = analyzeOPTIONS(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("blocks cross-origin POST with 403", async () => {
    const req = mockReq("https://app.example.com/api/analyze", {
      origin: "https://evil.example.com",
    });
    const res = await analyzePOST(req);
    expect(res.status).toBe(403);
  });

  it("returns 429 with rate limit headers when blocked (analyze)", async () => {
    const ip = "203.0.113.9";
    for (let i = 0; i < ANALYZE_LIMIT.maxRequests; i++) checkRateLimit(ip, ANALYZE_LIMIT);

    const req = mockReq("https://app.example.com/api/analyze", {
      origin: "https://app.example.com",
      "x-forwarded-for": ip,
    });

    const res = await analyzePOST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("x-ratelimit-limit")).toBe(String(ANALYZE_LIMIT.maxRequests));
    expect(res.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(res.headers.get("x-ratelimit-reset")).toBeTruthy();
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
  });

  it("returns 429 with rate limit headers when blocked (diff)", async () => {
    const ip = "203.0.113.10";
    for (let i = 0; i < DIFF_LIMIT.maxRequests; i++) checkRateLimit(ip, DIFF_LIMIT);

    const req = mockReq("https://app.example.com/api/diff", {
      origin: "https://app.example.com",
      "x-forwarded-for": ip,
    });

    const res = await diffPOST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("x-ratelimit-limit")).toBe(String(DIFF_LIMIT.maxRequests));
    expect(res.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(res.headers.get("x-ratelimit-reset")).toBeTruthy();
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
  });

  it("OPTIONS returns 204 for diff too", async () => {
    const req = mockReq("https://app.example.com/api/diff", {
      origin: "https://app.example.com",
    });
    const res = diffOPTIONS(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
  });
});

