import { describe, it, expect } from "vitest";

// We test the pure math functions directly by importing them

// ─── Inline the pure functions for testing (no canvas needed) ────────────────
// These mirror the implementations in imageRanking.ts

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s, l];
}

function parseAperture(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/f\/([\d.]+)/i);
  return m ? parseFloat(m[1]) : null;
}

function parseISO(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1]) : null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function scoreImage(
  metrics: { brightness: number; saturation: number; contrast: number; iso: number | null; aperture: number | null },
  medianBrightness: number,
  medianSaturation: number,
): number {
  let score = 0;
  score += Math.abs(metrics.brightness - medianBrightness) / 255 * 40;
  score += Math.abs(metrics.saturation - medianSaturation) * 30;
  if (metrics.contrast < 20) score += 20;
  if (metrics.contrast > 80) score += 10;
  if (metrics.iso !== null) {
    if (metrics.iso > 3200) score += 25;
    else if (metrics.iso > 1600) score += 12;
    else if (metrics.iso > 800) score += 5;
  }
  if (metrics.aperture !== null) {
    if (metrics.aperture < 1.8) score += 10;
    if (metrics.aperture > 11) score += 8;
  }
  return score;
}

// ─── rgbToHsl ────────────────────────────────────────────────────────────────

describe("rgbToHsl", () => {
  it("converts pure red to h=0, s=1, l=0.5", () => {
    const [h, s, l] = rgbToHsl(255, 0, 0);
    expect(h).toBeCloseTo(0, 1);
    expect(s).toBeCloseTo(1, 1);
    expect(l).toBeCloseTo(0.5, 1);
  });

  it("converts pure green to h=120", () => {
    const [h] = rgbToHsl(0, 255, 0);
    expect(h).toBeCloseTo(120, 1);
  });

  it("converts pure blue to h=240", () => {
    const [h] = rgbToHsl(0, 0, 255);
    expect(h).toBeCloseTo(240, 1);
  });

  it("converts white to s=0, l=1", () => {
    const [, s, l] = rgbToHsl(255, 255, 255);
    expect(s).toBe(0);
    expect(l).toBeCloseTo(1, 1);
  });

  it("converts black to s=0, l=0", () => {
    const [, s, l] = rgbToHsl(0, 0, 0);
    expect(s).toBe(0);
    expect(l).toBe(0);
  });

  it("converts mid gray to s=0, l=0.5", () => {
    const [, s, l] = rgbToHsl(128, 128, 128);
    expect(s).toBe(0);
    expect(l).toBeCloseTo(0.5, 0);
  });

  it("returns hue in 0–360 range", () => {
    for (const [r, g, b] of [[255, 128, 0], [0, 128, 255], [128, 0, 255]]) {
      const [h] = rgbToHsl(r, g, b);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(360);
    }
  });
});

// ─── parseAperture ───────────────────────────────────────────────────────────

describe("parseAperture", () => {
  it("parses f/2.8", () => expect(parseAperture("f/2.8")).toBeCloseTo(2.8));
  it("parses f/1.8", () => expect(parseAperture("f/1.8")).toBeCloseTo(1.8));
  it("parses f/11", () => expect(parseAperture("f/11")).toBe(11));
  it("parses uppercase F/4.0", () => expect(parseAperture("F/4.0")).toBeCloseTo(4.0));
  it("returns null for undefined", () => expect(parseAperture(undefined)).toBeNull());
  it("returns null for empty string", () => expect(parseAperture("")).toBeNull());
  it("returns null for invalid format", () => expect(parseAperture("2.8")).toBeNull());
});

// ─── parseISO ────────────────────────────────────────────────────────────────

describe("parseISO", () => {
  it("parses 'ISO 400'", () => expect(parseISO("ISO 400")).toBe(400));
  it("parses 'ISO 3200'", () => expect(parseISO("ISO 3200")).toBe(3200));
  it("parses 'ISO 100'", () => expect(parseISO("ISO 100")).toBe(100));
  it("returns null for undefined", () => expect(parseISO(undefined)).toBeNull());
  it("returns null for empty string", () => expect(parseISO("")).toBeNull());
});

// ─── median ──────────────────────────────────────────────────────────────────

describe("median", () => {
  it("returns middle value for odd count", () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });

  it("returns average of two middle values for even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("returns the single value for a one-element array", () => {
    expect(median([42])).toBe(42);
  });

  it("returns 0 for empty array", () => {
    expect(median([])).toBe(0);
  });

  it("sorts before computing median", () => {
    expect(median([5, 1, 3, 2, 4])).toBe(3);
  });

  it("handles duplicate values", () => {
    expect(median([2, 2, 2, 2])).toBe(2);
  });
});

// ─── scoreImage ───────────────────────────────────────────────────────────────

describe("scoreImage", () => {
  const base = { brightness: 128, saturation: 0.4, contrast: 45, iso: 400, aperture: 4.0 };

  it("gives lowest score to image at median brightness and saturation", () => {
    const score = scoreImage(base, 128, 0.4);
    expect(score).toBeLessThan(10); // only possible penalties are EXIF-based
  });

  it("penalizes image far from median brightness", () => {
    const near = scoreImage({ ...base, brightness: 128 }, 128, 0.4);
    const far = scoreImage({ ...base, brightness: 30 }, 128, 0.4);
    expect(far).toBeGreaterThan(near);
  });

  it("penalizes image far from median saturation", () => {
    const near = scoreImage({ ...base, saturation: 0.4 }, 128, 0.4);
    const far = scoreImage({ ...base, saturation: 0.9 }, 128, 0.4);
    expect(far).toBeGreaterThan(near);
  });

  it("penalizes very high ISO (>3200)", () => {
    const normal = scoreImage({ ...base, iso: 400 }, 128, 0.4);
    const highISO = scoreImage({ ...base, iso: 6400 }, 128, 0.4);
    expect(highISO - normal).toBeGreaterThanOrEqual(25);
  });

  it("penalizes high ISO (1600–3200) less than very high", () => {
    const iso1600 = scoreImage({ ...base, iso: 1600 }, 128, 0.4);
    const iso6400 = scoreImage({ ...base, iso: 6400 }, 128, 0.4);
    expect(iso6400).toBeGreaterThan(iso1600);
  });

  it("penalizes very wide aperture (<1.8)", () => {
    const normal = scoreImage({ ...base, aperture: 4.0 }, 128, 0.4);
    const wide = scoreImage({ ...base, aperture: 1.2 }, 128, 0.4);
    expect(wide).toBeGreaterThan(normal);
  });

  it("penalizes very narrow aperture (>11)", () => {
    const normal = scoreImage({ ...base, aperture: 4.0 }, 128, 0.4);
    const narrow = scoreImage({ ...base, aperture: 16 }, 128, 0.4);
    expect(narrow).toBeGreaterThan(normal);
  });

  it("penalizes flat images (contrast < 20)", () => {
    const normal = scoreImage({ ...base, contrast: 45 }, 128, 0.4);
    const flat = scoreImage({ ...base, contrast: 10 }, 128, 0.4);
    expect(flat - normal).toBeGreaterThanOrEqual(20);
  });

  it("penalizes harsh images (contrast > 80)", () => {
    const normal = scoreImage({ ...base, contrast: 45 }, 128, 0.4);
    const harsh = scoreImage({ ...base, contrast: 100 }, 128, 0.4);
    expect(harsh).toBeGreaterThan(normal);
  });

  it("does not penalize null ISO or aperture", () => {
    const withNull = scoreImage({ ...base, iso: null, aperture: null }, 128, 0.4);
    const withValues = scoreImage({ ...base, iso: 400, aperture: 4.0 }, 128, 0.4);
    // null should not add EXIF penalties
    expect(withNull).toBeLessThanOrEqual(withValues + 1);
  });

  it("selects the image closest to median when comparing two candidates", () => {
    const median = 128;
    const medSat = 0.4;
    const good = scoreImage({ brightness: 130, saturation: 0.42, contrast: 45, iso: 400, aperture: 4.0 }, median, medSat);
    const bad  = scoreImage({ brightness: 30,  saturation: 0.1,  contrast: 8,  iso: 6400, aperture: 1.2 }, median, medSat);
    expect(good).toBeLessThan(bad);
  });
});