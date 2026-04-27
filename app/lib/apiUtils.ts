import { NextResponse } from "next/server";

export function validatePayload(imageBase64: string): Response | null {
  if (!imageBase64) {
    return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
  }
  const MAX_BASE64_SIZE = 14 * 1024 * 1024;
  if (imageBase64.length > MAX_BASE64_SIZE) {
    return NextResponse.json(
      { error: "Image too large. Maximum size is 14MB base64." },
      { status: 413 }
    );
  }
  return null;
}

export function parseAIResponse(content: Array<{ type: string; text?: string }>): string {
  const raw = content.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("");
  return raw.replace(/```json|```/g, "").replace(/:\s*\+(\d)/g, ": $1").trim();
}

