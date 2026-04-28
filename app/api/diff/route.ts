import Anthropic from "@anthropic-ai/sdk";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { NextRequest, NextResponse } from "next/server";
import { parseAIResponse } from "@/app/lib/apiUtils";
import { buildRateLimitHeaders, checkRateLimit, getClientIp } from "@/app/lib/rateLimit";
import { DIFF_LIMIT } from "@/app/lib/rateLimitConfigs";

const client = new Anthropic({
  defaultHeaders: {
    "anthropic-beta": "prompt-caching-2024-07-31",
  },
});

// The static part of the diff prompt — this gets cached
const DIFF_SYSTEM_PROMPT = `You are an expert photo editor and colorist with deep knowledge of Adobe Lightroom Classic and Lightroom CC.

You will be given TWO images of the same scene: the ORIGINAL (unedited) and the EDITED version.
Your job is to analyze what Lightroom adjustments were applied to go from the original to the edited version.

Respond ONLY with a valid JSON object (no markdown, no explanation) in this exact structure:
{
  "style_summary": "One sentence describing what edits were applied",
  "confidence": "high | medium | low",
  "light": {
    "exposure": 0, "contrast": 0, "highlights": 0, "shadows": 0, "whites": 0, "blacks": 0
  },
  "color": {
    "temperature": 5500, "tint": 0, "vibrance": 0, "saturation": 0
  },
  "tone_curve": {
    "description": "Brief description of curve adjustment",
    "highlights": 0, "lights": 0, "darks": 0, "shadows": 0
  },
  "hsl": {
    "hue": { "red": 0, "orange": 0, "yellow": 0, "green": 0, "aqua": 0, "blue": 0, "purple": 0, "magenta": 0 },
    "saturation": { "red": 0, "orange": 0, "yellow": 0, "green": 0, "aqua": 0, "blue": 0, "purple": 0, "magenta": 0 },
    "luminance": { "red": 0, "orange": 0, "yellow": 0, "green": 0, "aqua": 0, "blue": 0, "purple": 0, "magenta": 0 }
  },
  "detail": { "sharpening": 40, "noise_reduction": 0, "color_noise_reduction": 25 },
  "effects": { "vignette_amount": 0, "vignette_midpoint": 50, "grain_amount": 0, "grain_size": 25, "grain_roughness": 50 },
  "color_grading": {
    "shadows_hue": 0, "shadows_saturation": 0, "midtones_hue": 0, "midtones_saturation": 0,
    "highlights_hue": 0, "highlights_saturation": 0, "blending": 50, "balance": 0
  },
  "calibration": {
    "shadows_hue": 0, "red_hue": 0, "red_saturation": 0,
    "green_hue": 0, "green_saturation": 0, "blue_hue": 0, "blue_saturation": 0
  }
}

Focus on the DIFFERENCES between the two images. Zero means no change was applied in that area.
Numeric value ranges: Exposure -5 to +5, all others -100 to +100, Temperature 2000-50000K.`;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(ip, DIFF_LIMIT);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${limit.retryAfter} seconds.` },
        {
          status: 429,
          headers: buildRateLimitHeaders(DIFF_LIMIT, limit),
        }
      );
    }

    const { originalBase64, originalMime, editedBase64, editedMime } = await req.json();

    if (!originalBase64 || !editedBase64) {
      return NextResponse.json({ error: "Missing images" }, { status: 400 });
    }

    const systemBlock: TextBlockParam = {
      type: "text",
      text: DIFF_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    };

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      // System prompt cached — saves tokens on every diff request
      system: [systemBlock],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Here is the ORIGINAL unedited photo:" },
            { type: "image", source: { type: "base64", media_type: originalMime, data: originalBase64 } },
            { type: "text", text: "Here is the EDITED version of the same photo:" },
            { type: "image", source: { type: "base64", media_type: editedMime, data: editedBase64 } },
            { type: "text", text: "Analyze the differences and return the JSON." },
          ],
        },
      ],
    });

    const clean = parseAIResponse(response.content);
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Diff error:", err);
    return NextResponse.json({ error: "Failed to compare images" }, { status: 500 });
  }
}