import Anthropic from "@anthropic-ai/sdk";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { NextRequest, NextResponse } from "next/server";
import { LIGHTROOM_SYSTEM_PROMPT } from "@/app/lib/prompt";
import { parseAIResponse, validatePayload } from "@/app/lib/apiUtils";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";
import { ANALYZE_LIMIT } from "@/app/lib/rateLimitConfigs";

type AllowedMimeType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function normalizeMimeType(mimeType: string | null): AllowedMimeType {
  if (mimeType === "image/jpeg") return "image/jpeg";
  if (mimeType === "image/png") return "image/png";
  if (mimeType === "image/gif") return "image/gif";
  if (mimeType === "image/webp") return "image/webp";
  return "image/jpeg";
}

// Prompt caching enabled — the large system prompt is cached for 5 minutes.
// Subsequent calls within the cache window skip re-processing the prompt,
// saving ~90% of input tokens on the system prompt.
const client = new Anthropic({
  defaultHeaders: {
    "anthropic-beta": "prompt-caching-2024-07-31",
  },
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(ip, ANALYZE_LIMIT);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${limit.retryAfter} seconds.` },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(ANALYZE_LIMIT.maxRequests),
            "X-RateLimit-Remaining": String(limit.remaining),
            "X-RateLimit-Reset": String(limit.resetAt),
            "Retry-After": String(limit.retryAfter),
          },
        }
      );
    }

    const contentType = req.headers.get("content-type") ?? "";

    let imageBase64: string | null = null;
    let mimeType: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      imageBase64 = body?.imageBase64 ?? null;
      mimeType = body?.mimeType ?? null;
    } else {
      const form = await req.formData();
      const file = form.get("image");
      const mt = form.get("mimeType");
      mimeType = typeof mt === "string" ? mt : null;

      if (file instanceof Blob) {
        const buf = Buffer.from(await file.arrayBuffer());
        imageBase64 = buf.toString("base64");
        if (!mimeType) mimeType = file.type || "image/jpeg";
      }
    }

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: "Missing imageBase64 or mimeType" },
        { status: 400 }
      );
    }

    const safeMimeType = normalizeMimeType(mimeType);

    const invalid = validatePayload(imageBase64);
    if (invalid) return invalid;

    const systemBlock: TextBlockParam = {
      type: "text",
      text: LIGHTROOM_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    };

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      // System prompt marked as cacheable — processed once, reused across requests
      system: [systemBlock],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: safeMimeType, data: imageBase64 },
            },
            {
              type: "text",
              text: "Analyze this image and provide the Lightroom settings to recreate its edit style.",
            },
          ],
        },
      ],
    });

    const clean = parseAIResponse(response.content);
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    );
  }
}