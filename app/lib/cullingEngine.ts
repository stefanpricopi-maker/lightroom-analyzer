/**
 * AI Culling Engine — 100% local, 0 API cost, 0 external ML dependencies.
 *
 * Three detectors:
 *  1. Blur        — Laplacian variance via canvas (~5ms/image)
 *  2. Closed eyes — Skin-tone face region + eye-band brightness analysis (~15ms/image)
 *  3. Duplicates  — dHash perceptual hashing (~2ms/image)
 */

export type CullingFlag = "blur" | "closed_eyes" | "duplicate" | "ok";

export interface CullingResult {
  itemId: string;
  flags: CullingFlag[];
  blurScore: number;
  eyeScore: number | null;
  hash: string;
  duplicateOf: string | null;
}

export interface CullingReport {
  results: CullingResult[];
  totalBlurry: number;
  totalClosedEyes: number;
  totalDuplicates: number;
  totalOk: number;
  processingMs: number;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const BLUR_THRESHOLD = 80;
const EYE_THRESHOLD = 0.55;        // ratio of dark pixels in eye band — above = likely closed
const HASH_DISTANCE_THRESHOLD = 8;

// ─── 1. Blur — Laplacian variance ────────────────────────────────────────────

export function computeBlurScore(imageSrc: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 128;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

      const gray = new Float32Array(SIZE * SIZE);
      for (let i = 0; i < SIZE * SIZE; i++) {
        const idx = i * 4;
        gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      }

      let sumSq = 0, count = 0;
      for (let y = 1; y < SIZE - 1; y++) {
        for (let x = 1; x < SIZE - 1; x++) {
          const idx = y * SIZE + x;
          const lap = gray[idx - SIZE] + gray[idx + SIZE] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx];
          sumSq += lap * lap;
          count++;
        }
      }
      resolve(Math.sqrt(sumSq / count));
    };
    img.onerror = () => resolve(0);
    img.src = imageSrc;
  });
}

// ─── 2. Closed eyes — skin-tone + eye-band analysis ──────────────────────────
//
// Approach (no ML required):
//  a) Find the largest skin-tone region (face area) using HSV thresholds
//  b) Crop the upper third of that region (where eyes are)
//  c) Measure darkness ratio in the eye band — closed eyes create a dark
//     horizontal band (lashes + lid) while open eyes show bright sclera

function isSkinTone(r: number, g: number, b: number): boolean {
  // HSV-based skin tone detection (works across ethnicities)
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  const h = (() => {
    if (max === min) return 0;
    const d = max - min;
    const rn = r / 255, gn = g / 255, bn = b / 255;
    if (max === rn) return (60 * ((gn - bn) / d) + 360) % 360;
    if (max === gn) return 60 * ((bn - rn) / d) + 120;
    return 60 * ((rn - gn) / d) + 240;
  })();
  return h >= 0 && h <= 50 && s >= 0.1 && s <= 0.8 && max >= 0.3;
}

export async function computeEyeScore(imageSrc: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const W = 64, H = 64;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, W, H);
      const { data } = ctx.getImageData(0, 0, W, H);

      // Find bounding box of skin-tone pixels
      let minX = W, maxX = 0, minY = H, maxY = 0;
      let skinCount = 0;

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = (y * W + x) * 4;
          if (isSkinTone(data[idx], data[idx + 1], data[idx + 2])) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            skinCount++;
          }
        }
      }

      // Need enough skin pixels and a reasonable face region
      const faceArea = (maxX - minX) * (maxY - minY);
      if (skinCount < 40 || faceArea < 100 || minX >= maxX || minY >= maxY) {
        resolve(null); // no face detected
        return;
      }

      // Eye band: upper 15–40% of face region
      const eyeTop = Math.floor(minY + (maxY - minY) * 0.15);
      const eyeBot = Math.floor(minY + (maxY - minY) * 0.40);
      const bandH = eyeBot - eyeTop;
      if (bandH < 3) { resolve(null); return; }

      // Count dark pixels in eye band
      let darkPixels = 0, totalPixels = 0;
      for (let y = eyeTop; y < eyeBot; y++) {
        for (let x = minX; x <= maxX; x++) {
          const idx = (y * W + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (lum < 80) darkPixels++; // dark = lashes, closed lid, or pupil
          totalPixels++;
        }
      }

      if (totalPixels === 0) { resolve(null); return; }
      resolve(darkPixels / totalPixels);
    };
    img.onerror = () => resolve(null);
    img.src = imageSrc;
  });
}

// ─── 3. Duplicates — dHash ────────────────────────────────────────────────────

export function computeHash(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const W = 9, H = 8;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, W, H);
      const { data } = ctx.getImageData(0, 0, W, H);

      const gray: number[] = [];
      for (let i = 0; i < W * H; i++) {
        const idx = i * 4;
        gray.push(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
      }

      let bits = "";
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W - 1; x++) {
          bits += gray[y * W + x] > gray[y * W + x + 1] ? "1" : "0";
        }
      }

      const hex =
        parseInt(bits.slice(0, 32), 2).toString(16).padStart(8, "0") +
        parseInt(bits.slice(32, 64), 2).toString(16).padStart(8, "0");
      resolve(hex);
    };
    img.onerror = () => resolve("0000000000000000");
    img.src = imageSrc;
  });
}

export function hammingDistance(a: string, b: string): number {
  let dist = 0;
  const aBin = BigInt("0x" + a).toString(2).padStart(64, "0");
  const bBin = BigInt("0x" + b).toString(2).padStart(64, "0");
  for (let i = 0; i < 64; i++) if (aBin[i] !== bBin[i]) dist++;
  return dist;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export interface CullingOptions {
  detectBlur?: boolean;
  detectClosedEyes?: boolean;
  detectDuplicates?: boolean;
  blurThreshold?: number;
  eyeThreshold?: number;
  hashDistanceThreshold?: number;
}

export async function runCulling(
  items: Array<{ id: string; thumbnail: string }>,
  options: CullingOptions = {},
  onProgress?: (done: number, total: number) => void,
): Promise<CullingReport> {
  const {
    detectBlur = true,
    detectClosedEyes = true,
    detectDuplicates = true,
    blurThreshold = BLUR_THRESHOLD,
    eyeThreshold = EYE_THRESHOLD,
    hashDistanceThreshold = HASH_DISTANCE_THRESHOLD,
  } = options;

  const startMs = performance.now();
  const results: CullingResult[] = [];

  for (let i = 0; i < items.length; i++) {
    const { id, thumbnail } = items[i];

    const [blurScore, eyeScore, hash] = await Promise.all([
      detectBlur        ? computeBlurScore(thumbnail) : Promise.resolve(999),
      detectClosedEyes  ? computeEyeScore(thumbnail)  : Promise.resolve(null),
      detectDuplicates  ? computeHash(thumbnail)       : Promise.resolve("0000000000000000"),
    ]);

    results.push({ itemId: id, flags: [], blurScore, eyeScore, hash, duplicateOf: null });
    onProgress?.(i + 1, items.length);
  }

  if (detectBlur)
    for (const r of results)
      if (r.blurScore < blurThreshold) r.flags.push("blur");

  if (detectClosedEyes)
    for (const r of results)
      if (r.eyeScore !== null && r.eyeScore > eyeThreshold) r.flags.push("closed_eyes");

  if (detectDuplicates) {
    const seen: Array<{ itemId: string; hash: string }> = [];
    for (const r of results) {
      const match = seen.find((s) => hammingDistance(s.hash, r.hash) <= hashDistanceThreshold);
      if (match) { r.flags.push("duplicate"); r.duplicateOf = match.itemId; }
      else seen.push({ itemId: r.itemId, hash: r.hash });
    }
  }

  for (const r of results) if (r.flags.length === 0) r.flags.push("ok");

  return {
    results,
    totalBlurry:     results.filter((r) => r.flags.includes("blur")).length,
    totalClosedEyes: results.filter((r) => r.flags.includes("closed_eyes")).length,
    totalDuplicates: results.filter((r) => r.flags.includes("duplicate")).length,
    totalOk:         results.filter((r) => r.flags[0] === "ok").length,
    processingMs:    Math.round(performance.now() - startMs),
  };
}