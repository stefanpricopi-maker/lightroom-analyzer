import { describe, it, expect } from "vitest";
import { generateXMP, escapeXML, sanitizeFilename } from "@/app/lib/xmp";
import type { LightroomResult } from "@/app/lib/types";

const mockResult: LightroomResult = {
  style_summary: "Warm cinematic look",
  confidence: "high",
  light: { exposure: 0.5, contrast: 10, highlights: -30, shadows: 20, whites: -10, blacks: -20 },
  color: { temperature: 5800, tint: 5, vibrance: 15, saturation: -5 },
  tone_curve: { description: "S-curve", highlights: 10, lights: 5, darks: -5, shadows: -10 },
  hsl: {
    hue: { red: 0, orange: 10, yellow: -5, green: 0, aqua: 0, blue: 0, purple: 0, magenta: 0 },
    saturation: { red: 10, orange: 20, yellow: 0, green: -10, aqua: 0, blue: 0, purple: 0, magenta: 0 },
    luminance: { red: 0, orange: 5, yellow: 0, green: 0, aqua: 0, blue: 0, purple: 0, magenta: 0 },
  },
  detail: { sharpening: 50, noise_reduction: 20, color_noise_reduction: 25 },
  effects: { vignette_amount: -15, vignette_midpoint: 50, grain_amount: 10, grain_size: 25, grain_roughness: 50 },
  color_grading: { shadows_hue: 220, shadows_saturation: 10, midtones_hue: 0, midtones_saturation: 0, highlights_hue: 40, highlights_saturation: 5, blending: 50, balance: 0 },
  calibration: { shadows_hue: 0, red_hue: 5, red_saturation: 10, green_hue: 0, green_saturation: 0, blue_hue: -5, blue_saturation: 0 },
};

describe("generateXMP", () => {
  it("produces valid XML structure", () => {
    const xmp = generateXMP(mockResult, "Test Preset");
    expect(xmp).toContain("<?xpacket");
    expect(xmp).toContain("<x:xmpmeta");
    expect(xmp).toContain("</x:xmpmeta>");
    expect(xmp).toContain('<?xpacket end="w"?>');
  });

  it("includes the preset name", () => {
    const xmp = generateXMP(mockResult, "My Wedding Preset");
    expect(xmp).toContain('crs:Name="My Wedding Preset"');
  });

  it("writes correct exposure value", () => {
    const xmp = generateXMP(mockResult, "Test");
    expect(xmp).toContain('crs:Exposure2012="0.50"');
  });

  it("writes correct temperature value", () => {
    const xmp = generateXMP(mockResult, "Test");
    expect(xmp).toContain('crs:Temperature="5800"');
  });

  it("writes correct negative vignette", () => {
    const xmp = generateXMP(mockResult, "Test");
    expect(xmp).toContain('crs:VignetteAmount="-15"');
  });

  it("writes HSL hue adjustments", () => {
    const xmp = generateXMP(mockResult, "Test");
    expect(xmp).toContain('crs:HueAdjustmentOrange="10"');
    expect(xmp).toContain('crs:HueAdjustmentYellow="-5"');
  });

  it("writes sharpening value", () => {
    const xmp = generateXMP(mockResult, "Test");
    expect(xmp).toContain('crs:Sharpness="50"');
  });

  it("handles zero values correctly", () => {
    const zeroResult = { ...mockResult, light: { ...mockResult.light, contrast: 0 } };
    const xmp = generateXMP(zeroResult, "Test");
    expect(xmp).toContain('crs:Contrast2012="0"');
  });
});

describe("XMP sanitization", () => {
  it("escapes double quotes in preset name", () => {
    const xmp = generateXMP(mockResult, 'My "Best" Preset');
    expect(xmp).toContain('crs:Name="My &quot;Best&quot; Preset"');
    expect(xmp).not.toContain('crs:Name="My "Best" Preset"');
  });

  it("escapes ampersands in preset name", () => {
    const xmp = generateXMP(mockResult, "Wedding & Portrait");
    expect(xmp).toContain("Wedding &amp; Portrait");
  });

  it("escapes angle brackets in preset name", () => {
    const xmp = generateXMP(mockResult, "<script>alert(1)</script>");
    expect(xmp).toContain("&lt;script&gt;");
    expect(xmp).not.toContain("<script>");
  });

  it("removes control characters from preset name", () => {
    const xmp = generateXMP(mockResult, "My\x00Preset\x1F");
    expect(xmp).toContain('crs:Name="MyPreset"');
  });

  it("falls back to 'My Preset' when name is empty", () => {
    const xmp = generateXMP(mockResult, "");
    expect(xmp).toContain('crs:Name="My Preset"');
  });

  it("falls back to 'My Preset' when name is only whitespace", () => {
    const xmp = generateXMP(mockResult, "   ");
    expect(xmp).toContain('crs:Name="My Preset"');
  });
});