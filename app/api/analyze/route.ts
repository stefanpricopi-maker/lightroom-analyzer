import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { LIGHTROOM_SYSTEM_PROMPT } from "@/app/lib/prompt";

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
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: "Missing imageBase64 or mimeType" },
        { status: 400 }
      );
    }

    const MAX_BASE64_SIZE = 14 * 1024 * 1024;
    if (imageBase64.length > MAX_BASE64_SIZE) {
      return NextResponse.json(
        { error: "Image too large. Maximum size is 10MB." },
        { status: 413 }
      );
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      // System prompt marked as cacheable — processed once, reused across requests
      // @ts-ignore — cache_control is valid with prompt-caching-2024-07-31 beta
      system: [
        {
          type: "text",
          text: LIGHTROOM_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
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
              text: "Analyze this image and provide the Lightroom settings to recreate its edit style.",
            },
          ],
        },
      ],
    });

    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    const clean = text
      .replace(/```json|```/g, "")
      .replace(/:\s*\+(\d)/g, ": $1")
      .trim();

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