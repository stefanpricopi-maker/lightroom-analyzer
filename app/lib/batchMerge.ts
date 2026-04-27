import type { LightroomResult } from "@/app/lib/types";

/**
 * Merges hero color style with individual photo light settings.
 * - Light panel (exposure, contrast, highlights, shadows, whites, blacks) → from individual photo
 * - Everything else (color, hsl, color_grading, calibration, detail, effects) → from hero
 */
export function mergeHeroWithPhoto(
  hero: LightroomResult,
  photo: LightroomResult
): LightroomResult {
  return {
    ...hero,                    // base: hero color style
    style_summary: photo.style_summary,
    confidence: photo.confidence,
    light: photo.light,         // exposure from individual photo
    tone_curve: photo.tone_curve, // tone curve from individual photo
  };
}