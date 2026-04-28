import { NextRequest, NextResponse } from "next/server";

function getRequestOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  return origin && origin.trim() ? origin : null;
}

function getSameOrigin(req: NextRequest): string {
  return new URL(req.url).origin;
}

function isAllowedOrigin(req: NextRequest, origin: string): boolean {
  const configured = process.env.LR_ANALYZER_ALLOWED_ORIGIN?.trim();
  if (configured) return origin === configured;
  // Default: only allow same-origin requests.
  return origin === getSameOrigin(req);
}

export function getCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = getRequestOrigin(req);
  if (!origin) return {};
  if (!isAllowedOrigin(req, origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    Vary: "Origin",
  };
}

export function requireCorsAllowed(req: NextRequest): NextResponse | null {
  const origin = getRequestOrigin(req);
  if (!origin) return null;
  if (isAllowedOrigin(req, origin)) return null;

  return NextResponse.json({ error: "CORS origin not allowed" }, { status: 403 });
}

export function withCors(req: NextRequest, res: NextResponse): NextResponse {
  const headers = getCorsHeaders(req);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export function corsOptions(req: NextRequest): NextResponse {
  const forbidden = requireCorsAllowed(req);
  if (forbidden) return forbidden;
  return withCors(req, new NextResponse(null, { status: 204 }));
}

