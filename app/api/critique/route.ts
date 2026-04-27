import Anthropic from "@anthropic-ai/sdk";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { NextRequest, NextResponse } from "next/server";
import { parseAIResponse, validatePayload } from "@/app/lib/apiUtils";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";
import { CRITIQUE_LIMIT } from "@/app/lib/rateLimitConfigs";

type AllowedMimeType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function normalizeMimeType(mimeType: string | null): AllowedMimeType {
  if (mimeType === "image/jpeg") return "image/jpeg";
  if (mimeType === "image/png") return "image/png";
  if (mimeType === "image/gif") return "image/gif";
  if (mimeType === "image/webp") return "image/webp";
  return "image/jpeg";
}

const CRITIQUE_SYSTEM_PROMPT = `You are an expert photography educator and photo editor with deep knowledge of Adobe Lightroom and photographic technique.

Analyze the uploaded photo and identify technical problems and improvement opportunities. Be specific, constructive, and educational.

Respond ONLY with a valid JSON object (no markdown):
{
  "overall_score": 7,
  "summary": "One sentence overall assessment",
  "issues": [
    {
      "category": "Exposure|White Balance|Contrast|Color|Highlights|Shadows|Sharpness|Noise|Composition",
      "severity": "critical|warning|suggestion",
      "title": "Short issue title",
      "description": "2-3 sentences explaining the problem and why it matters",
      "fix": {
        "panel": "Light|Color|Detail|Effects",
        "adjustments": [
          { "parameter": "Exposure2012", "value": -0.5, "reason": "why this value" }
        ]
      }
    }
  ],
  "strengths": ["What is already good about this photo"],
  "priority_fixes": ["Top 3 most important things to fix, in order"]
}

Severity guide:
- critical: significantly hurts the photo (blown highlights, severe color cast, out of focus)
- warning: noticeable issue that should be fixed (slight underexposure, warm cast)
- suggestion: optional improvement (could add a touch more contrast)

Be honest but constructive. Focus on technical correctness first, creative choices second.`;

const client = new Anthropic({
  defaultHeaders: {
    "anthropic-beta": "prompt-caching-2024-07-31",
  },
});

function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function parseModelJson(raw: string): unknown {
  const clean = parseAIResponse([{ type: "text", text: raw }]);

  try {
    return JSON.parse(clean);
  } catch {
    // Try to extract the first JSON object if the model added extra text.
    const extracted = extractFirstJsonObject(clean);
    if (!extracted) throw new Error("Model did not return a JSON object.");
    return JSON.parse(extracted);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(ip, CRITIQUE_LIMIT);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${limit.retryAfter} seconds.` },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(CRITIQUE_LIMIT.maxRequests),
            "X-RateLimit-Remaining": String(limit.remaining),
            "X-RateLimit-Reset": String(limit.resetAt),
            "Retry-After": String(limit.retryAfter),
          },
        }
      );
    }

    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: "Missing imageBase64 or mimeType" },
        { status: 400 }
      );
    }

    const invalid = validatePayload(imageBase64);
    if (invalid) return invalid;

    const safeMimeType = normalizeMimeType(mimeType);

    const systemBlock: TextBlockParam = {
      type: "text",
      text: CRITIQUE_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    };

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
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
              text: "Provide a technical critique of this photo and Lightroom fixes as JSON.",
            },
          ],
        },
      ],
    });

    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    try {
      const result = parseModelJson(text);
      return NextResponse.json(result);
    } catch (e) {
      console.error("Critique parse error:", e);
      // This is upstream/model formatting, not a server bug.
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again." },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("Critique error:", err);
    return NextResponse.json(
      { error: "Failed to critique image" },
      { status: 500 }
    );
  }
}

