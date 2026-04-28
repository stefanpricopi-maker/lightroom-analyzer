import Anthropic from "@anthropic-ai/sdk";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { NextRequest, NextResponse } from "next/server";
import { parseAIResponse, validatePayload } from "@/app/lib/apiUtils";
import { buildRateLimitHeaders, checkRateLimit, getClientIp } from "@/app/lib/rateLimit";
import { BATCH_LIMIT } from "@/app/lib/rateLimitConfigs";

// Prompt caching is most impactful here — this route is called once per photo
// in a batch of potentially 500 images. Caching saves ~90% of prompt tokens
// on every call after the first within the 5-minute cache window.
const client = new Anthropic({
  defaultHeaders: {
    "anthropic-beta": "prompt-caching-2024-07-31",
  },
});

// Static part of the prompt — gets cached
const BATCH_SYSTEM_PROMPT = `You are an expert photo editor with deep knowledge of Adobe Lightroom.

Your ONLY task is to analyze the exposure and tonal characteristics of a photo and return the Lightroom Light panel adjustments needed to achieve a well-balanced, professionally edited exposure.

Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "exposure": 0,
  "contrast": 0,
  "highlights": 0,
  "shadows": 0,
  "whites": 0,
  "blacks": 0,
  "reasoning": "One sentence explaining the main exposure characteristic of this image"
}

Ranges: exposure -5 to +5, all others -100 to +100.
Do NOT include a leading + sign on positive numbers.`;

export interface BatchLightResult {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  reasoning: string;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(ip, BATCH_LIMIT);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${limit.retryAfter} seconds.` },
        {
          status: 429,
          headers: buildRateLimitHeaders(BATCH_LIMIT, limit),
        }
      );
    }

    const { imageBase64, mimeType, exifHint } = await req.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "Missing imageBase64 or mimeType" }, { status: 400 });
    }

    const invalid = validatePayload(imageBase64);
    if (invalid) return invalid;

    // Build the dynamic EXIF hint as a separate user message block (not cached)
    const exifContext = exifHint
      ? `Camera settings for this photo: ${exifHint}. Use this to inform your exposure estimate — high ISO suggests noise/underexposure, wide aperture suggests shallow DOF, fast shutter indicates bright conditions.`
      : "No EXIF data available for this photo.";

    const systemBlock: TextBlockParam = {
      type: "text",
      text: BATCH_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    };

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      // Static system prompt cached — the EXIF hint varies per photo so it stays in the user turn
      system: [systemBlock],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: imageBase64 },
            },
            {
              type: "text",
              text: exifContext,
            },
          ],
        },
      ],
    });

    const clean = parseAIResponse(response.content);
    const result: BatchLightResult = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Batch analyze error:", err);
    return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 });
  }
}