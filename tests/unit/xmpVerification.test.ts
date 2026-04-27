import { describe, it, expect } from "vitest";
import { generateXMP } from "@/app/lib/xmp";
import type { LightroomResult } from "@/app/lib/types";
import { DOMParser } from "@xmldom/xmldom";

// ─── Test fixture ────────────────────────────────────────────────────────────

const mockResult: LightroomResult = {
  style_summary: "Warm cinematic look",
  confidence: "high",
  light: {
    exposure: 0.5,
    contrast: 10,
    highlights: -30,
    shadows: 20,
    whites: -10,
    blacks: -20,
  },
  color: {
    temperature: 5800,
    tint: 5,
    vibrance: 15,
    saturation: -5,
  },
  tone_curve: {
    description: "S-curve",
    highlights: 10,
    lights: 5,
    darks: -5,
    shadows: -10,
  },
  hsl: {
    hue: { red: 5, orange: 10, yellow: -5, green: 0, aqua: 0, blue: -10, purple: 0, magenta: 0 },
    saturation: { red: 10, orange: 20, yellow: 0, green: -10, aqua: 0, blue: 0, purple: 0, magenta: 5 },
    luminance: { red: 0, orange: 5, yellow: 0, green: -5, aqua: 0, blue: 0, purple: 0, magenta: 0 },
  },
  detail: { sharpening: 50, noise_reduction: 20, color_noise_reduction: 25 },
  effects: { vignette_amount: -15, vignette_midpoint: 50, grain_amount: 10, grain_size: 25, grain_roughness: 50 },
  color_grading: {
    shadows_hue: 220, shadows_saturation: 10,
    midtones_hue: 0, midtones_saturation: 0,
    highlights_hue: 40, highlights_saturation: 5,
    blending: 50, balance: 0,
  },
  calibration: {
    shadows_hue: 0, red_hue: 5, red_saturation: 10,
    green_hue: 0, green_saturation: 0,
    blue_hue: -5, blue_saturation: 0,
  },
};

// ─── XML parsing helpers ─────────────────────────────────────────────────────

function parseXMP(xmp: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmp, "text/xml");
  return doc;
}

function getAttr(doc: Document, attr: string): string | null {
  // Attributes are on the rdf:Description element
  const desc = doc.getElementsByTagNameNS(
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "Description"
  )[0];
  if (!desc) return null;
  return desc.getAttribute(attr) ?? desc.getAttributeNS("http://ns.adobe.com/camera-raw-settings/1.0/", attr.replace("crs:", ""));
}

function attr(doc: Document, name: string): string | null {
  const desc = doc.getElementsByTagName("rdf:Description")[0];
  if (!desc) return null;
  // Try with namespace prefix first, then without
  return desc.getAttribute(`crs:${name}`) ?? desc.getAttribute(name);
}

// ─── Valid XML structure ─────────────────────────────────────────────────────

describe("XMP — valid XML structure", () => {
  it("generates well-formed XML that can be parsed without errors", () => {
    const xmp = generateXMP(mockResult, "Test Preset");
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmp, "text/xml");
    const errors = doc.getElementsByTagName("parsererror");
    expect(errors.length).toBe(0);
  });

  it("contains xmpmeta root element", () => {
    const xmp = generateXMP(mockResult, "Test Preset");
    const doc = parseXMP(xmp);
    const root = doc.getElementsByTagName("x:xmpmeta");
    expect(root.length).toBeGreaterThan(0);
  });

  it("contains rdf:RDF element", () => {
    const xmp = generateXMP(mockResult, "Test Preset");
    const doc = parseXMP(xmp);
    expect(doc.getElementsByTagName("rdf:RDF").length).toBeGreaterThan(0);
  });

  it("contains rdf:Description element", () => {
    const xmp = generateXMP(mockResult, "Test Preset");
    const doc = parseXMP(xmp);
    expect(doc.getElementsByTagName("rdf:Description").length).toBeGreaterThan(0);
  });

  it("starts with xpacket begin marker", () => {
    const xmp = generateXMP(mockResult, "Test Preset");
    expect(xmp.startsWith('<?xpacket begin=""')).toBe(true);
  });

  it("ends with xpacket end marker", () => {
    const xmp = generateXMP(mockResult, "Test Preset");
    expect(xmp.trimEnd().endsWith('<?xpacket end="w"?>')).toBe(true);
  });
});

// ─── Preset metadata ─────────────────────────────────────────────────────────

describe("XMP — preset metadata", () => {
  it("writes the preset name", () => {
    const xmp = generateXMP(mockResult, "Wedding Edit");
    expect(xmp).toContain('crs:Name="Wedding Edit"');
  });

  it("writes ProcessVersion", () => {
    const xmp = generateXMP(mockResult, "Test");
    expect(xmp).toContain('crs:ProcessVersion="11.0"');
  });

  it("writes PresetType as Normal", () => {
    const xmp = generateXMP(mockResult, "Test");
    expect(xmp).toContain('crs:PresetType="Normal"');
  });
});

// ─── Light panel values ───────────────────────────────────────────────────────

describe("XMP — light panel values round-trip", () => {
  it("writes Exposure2012 with 2 decimal places", () => {
    const xmp = generateXMP(mockResult, "Test");
    expect(xmp).toContain('crs:Exposure2012="0.50"');
  });

  it("writes negative exposure correctly", () => {
    const result = { ...mockResult, light: { ...mockResult.light, exposure: -1.5 } };
    expect(generateXMP(result, "Test")).toContain('crs:Exposure2012="-1.50"');
  });

  it("writes Contrast2012", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:Contrast2012="10"');
  });

  it("writes negative Highlights2012", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:Highlights2012="-30"');
  });

  it("writes Shadows2012", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:Shadows2012="20"');
  });

  it("writes Whites2012", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:Whites2012="-10"');
  });

  it("writes Blacks2012", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:Blacks2012="-20"');
  });
});

// ─── Color panel values ───────────────────────────────────────────────────────

describe("XMP — color panel values round-trip", () => {
  it("writes Temperature rounded to integer", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:Temperature="5800"');
  });

  it("writes Tint", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:Tint="5"');
  });

  it("writes Vibrance", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:Vibrance="15"');
  });

  it("writes negative Saturation", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:Saturation="-5"');
  });

  it("writes WhiteBalance as Custom", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:WhiteBalance="Custom"');
  });
});

// ─── HSL values ───────────────────────────────────────────────────────────────

describe("XMP — HSL values round-trip", () => {
  it("writes HueAdjustmentRed", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:HueAdjustmentRed="5"');
  });

  it("writes HueAdjustmentOrange", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:HueAdjustmentOrange="10"');
  });

  it("writes negative HueAdjustmentYellow", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:HueAdjustmentYellow="-5"');
  });

  it("writes SaturationAdjustmentRed", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:SaturationAdjustmentRed="10"');
  });

  it("writes negative SaturationAdjustmentGreen", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:SaturationAdjustmentGreen="-10"');
  });

  it("writes LuminanceAdjustmentOrange", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:LuminanceAdjustmentOrange="5"');
  });

  it("writes negative LuminanceAdjustmentGreen", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:LuminanceAdjustmentGreen="-5"');
  });
});

// ─── Detail panel values ──────────────────────────────────────────────────────

describe("XMP — detail panel values round-trip", () => {
  it("writes Sharpness", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:Sharpness="50"');
  });

  it("writes LuminanceSmoothing (noise reduction)", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:LuminanceSmoothing="20"');
  });

  it("writes ColorNoiseReduction", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:ColorNoiseReduction="25"');
  });
});

// ─── Effects panel values ─────────────────────────────────────────────────────

describe("XMP — effects panel values round-trip", () => {
  it("writes negative VignetteAmount", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:VignetteAmount="-15"');
  });

  it("writes VignetteMidpoint", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:VignetteMidpoint="50"');
  });

  it("writes GrainAmount", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:GrainAmount="10"');
  });
});

// ─── Calibration values ───────────────────────────────────────────────────────

describe("XMP — calibration values round-trip", () => {
  it("writes RedHue", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:RedHue="5"');
  });

  it("writes RedSaturation", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:RedSaturation="10"');
  });

  it("writes negative BlueHue", () => {
    expect(generateXMP(mockResult, "Test")).toContain('crs:BlueHue="-5"');
  });
});

// ─── Zero values ─────────────────────────────────────────────────────────────

describe("XMP — zero values are written correctly", () => {
  const zeroResult: LightroomResult = {
    ...mockResult,
    light: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0 },
    color: { temperature: 5500, tint: 0, vibrance: 0, saturation: 0 },
  };

  it("writes zero exposure as 0.00", () => {
    expect(generateXMP(zeroResult, "Test")).toContain('crs:Exposure2012="0.00"');
  });

  it("writes zero contrast as 0", () => {
    expect(generateXMP(zeroResult, "Test")).toContain('crs:Contrast2012="0"');
  });

  it("writes zero tint as 0", () => {
    expect(generateXMP(zeroResult, "Test")).toContain('crs:Tint="0"');
  });
});

// ─── Extreme values ───────────────────────────────────────────────────────────

describe("XMP — extreme values are clamped/written correctly", () => {
  it("writes max exposure +5", () => {
    const result = { ...mockResult, light: { ...mockResult.light, exposure: 5 } };
    expect(generateXMP(result, "Test")).toContain('crs:Exposure2012="5.00"');
  });

  it("writes min exposure -5", () => {
    const result = { ...mockResult, light: { ...mockResult.light, exposure: -5 } };
    expect(generateXMP(result, "Test")).toContain('crs:Exposure2012="-5.00"');
  });

  it("writes max contrast +100", () => {
    const result = { ...mockResult, light: { ...mockResult.light, contrast: 100 } };
    expect(generateXMP(result, "Test")).toContain('crs:Contrast2012="100"');
  });

  it("writes min contrast -100", () => {
    const result = { ...mockResult, light: { ...mockResult.light, contrast: -100 } };
    expect(generateXMP(result, "Test")).toContain('crs:Contrast2012="-100"');
  });
});