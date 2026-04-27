import type { NextRequest } from "next/server";

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
