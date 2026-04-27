/**
 * Local image ranking utility — runs entirely in the browser via canvas.
 * No API calls, no cost.
 */

import { extractExif, readFileAsBuffer } from "@/app/lib/exif";
import type { ExifData } from "@/app/lib/exif";
import type { BatchItem } from "@/app/lib/batchTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageMetrics {
  itemId: string;
  brightness: number;     // 0–255 average luminance
  saturation: number;     // 0–1 average saturation
  contrast: number;       // standard deviation of luminance (higher = more contrast)
  dominantHue: number;    // 0–360 most common hue
  iso: number | null;
  aperture: number | null;
  score: number;          // lower = better hero candidate
}

export interface HeroRecommendation {
  recommendedId: string;
  metrics: ImageMetrics[];
  reason: string;
}

// ─── Canvas analysis ──────────────────────────────────────────────────────────

/**
 * Load an image from a blob URL or data URL, draw it on a 64x64 canvas,
 * and return the pixel data for fast analysis.
 */
function loadImagePixels(src: string): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const SIZE = 64; // small sample for speed
      const canvas = document.createElement("canvas");
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      resolve(ctx.getImageData(0, 0, SIZE, SIZE).data);
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Convert RGB to HSL.
 * Returns h: 0–360, s: 0–1, l: 0–1
 */
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

/**
 * Analyse a thumbnail image and extract perceptual metrics.
 */
export async function analyzeImage(thumbnail: string): Promise<{
  brightness: number;
  saturation: number;
  contrast: number;
  dominantHue: number;
}> {
  const pixels = await loadImagePixels(thumbnail);
  const count = pixels.length / 4;

  let sumL = 0, sumS = 0;
  const hueHistogram = new Float32Array(36); // 10° buckets
  const luminances: number[] = [];

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);
    sumL += l;
    sumS += s;
    luminances.push(l);
    if (s > 0.15) { // only count saturated pixels for hue histogram
      hueHistogram[Math.floor(h / 10)] += 1;
    }
  }

  const brightness = (sumL / count) * 255;
  const saturation = sumS / count;

  // Contrast = standard deviation of luminance
  const meanL = sumL / count;
  const variance = luminances.reduce((acc, l) => acc + Math.pow(l - meanL, 2), 0) / count;
  const contrast = Math.sqrt(variance) * 255;

  // Dominant hue = peak of hue histogram
  const maxBucket = hueHistogram.indexOf(Math.max(...hueHistogram));
  const dominantHue = maxBucket * 10;

  return { brightness, saturation, contrast, dominantHue };
}

// ─── EXIF scoring ─────────────────────────────────────────────────────────────

/**
 * Parse aperture string like "f/2.8" → 2.8
 */
function parseAperture(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/f\/([\d.]+)/i);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Parse ISO string like "ISO 400" → 400
 */
function parseISO(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1]) : null;
}

// ─── Ranking algorithm ────────────────────────────────────────────────────────

/**
 * Score an image for hero suitability.
 * Lower score = better hero candidate.
 *
 * Criteria:
 * - Brightness close to the group median (not too dark, not blown out)
 * - Saturation close to the group median (representative color)
 * - Reasonable contrast (not flat, not overly harsh)
 * - Moderate ISO (prefer lower ISO = cleaner image)
 * - Moderate aperture (avoid very wide = shallow DOF or very narrow = diffraction)
 */
function scoreImage(
  metrics: Omit<ImageMetrics, "itemId" | "score">,
  medianBrightness: number,
  medianSaturation: number,
): number {
  let score = 0;

  // Distance from median brightness (normalized 0–255)
  score += Math.abs(metrics.brightness - medianBrightness) / 255 * 40;

  // Distance from median saturation (0–1)
  score += Math.abs(metrics.saturation - medianSaturation) * 30;

  // Penalize very low contrast (flat/foggy image)
  if (metrics.contrast < 20) score += 20;

  // Penalize very high contrast (harshly lit)
  if (metrics.contrast > 80) score += 10;

  // EXIF penalties
  if (metrics.iso !== null) {
    if (metrics.iso > 3200) score += 25;       // very noisy
    else if (metrics.iso > 1600) score += 12;
    else if (metrics.iso > 800) score += 5;
  }

  if (metrics.aperture !== null) {
    if (metrics.aperture < 1.8) score += 10;   // very shallow DOF
    if (metrics.aperture > 11) score += 8;     // diffraction risk
  }

  return score;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Analyse all items in a group and recommend the best hero shot.
 * Runs fully client-side — no API calls.
 */
export async function recommendHero(items: BatchItem[]): Promise<HeroRecommendation | null> {
  if (items.length === 0) return null;
  if (items.length === 1) {
    return {
      recommendedId: items[0].id,
      metrics: [],
      reason: "Only one photo in the group.",
    };
  }

  // Read EXIF + canvas metrics in parallel
  const rawMetrics = await Promise.all(
    items.map(async (item): Promise<ImageMetrics> => {
      const [visual, exifData] = await Promise.all([
        analyzeImage(item.thumbnail).catch(() => ({ brightness: 128, saturation: 0.3, contrast: 40, dominantHue: 0 })),
        readFileAsBuffer(item.file).then(extractExif).catch(() => ({} as ExifData)),
      ]);
      return {
        itemId: item.id,
        ...visual,
        iso: parseISO(exifData.iso),
        aperture: parseAperture(exifData.aperture),
        score: 0, // computed below
      };
    })
  );

  // Compute group medians
  const medianBrightness = median(rawMetrics.map((m) => m.brightness));
  const medianSaturation = median(rawMetrics.map((m) => m.saturation));

  // Score each image
  const metrics: ImageMetrics[] = rawMetrics.map((m) => ({
    ...m,
    score: scoreImage(m, medianBrightness, medianSaturation),
  }));

  // Best = lowest score
  const best = metrics.reduce((a, b) => a.score < b.score ? a : b);

  // Build human-readable reason
  const reasons: string[] = [];
  if (best.iso !== null && best.iso <= 800) reasons.push(`low ISO ${best.iso}`);
  const brightnessDiff = Math.abs(best.brightness - medianBrightness);
  if (brightnessDiff < 15) reasons.push("exposure close to group median");
  if (best.contrast > 25 && best.contrast < 70) reasons.push("balanced contrast");
  const reason = reasons.length > 0
    ? `Best match: ${reasons.join(", ")}.`
    : "Closest to the group's average exposure and color.";

  return { recommendedId: best.itemId, metrics, reason };
}