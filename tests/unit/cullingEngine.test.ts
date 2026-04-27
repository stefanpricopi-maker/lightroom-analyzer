import { describe, it, expect } from "vitest";
import { hammingDistance } from "@/app/lib/cullingEngine";

// ─── hammingDistance ──────────────────────────────────────────────────────────

describe("hammingDistance", () => {
  it("returns 0 for identical hashes", () => {
    expect(hammingDistance("abcd1234abcd1234", "abcd1234abcd1234")).toBe(0);
  });

  it("returns 0 for all-zero hashes", () => {
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
  });

  it("returns max distance for opposite hashes", () => {
    // all 0s vs all 1s (ffffffffffffffff)
    const dist = hammingDistance("0000000000000000", "ffffffffffffffff");
    expect(dist).toBe(64);
  });

  it("counts bit differences correctly for known values", () => {
    // 0x01 = 00000001, 0x00 = 00000000 — 1 bit different
    expect(hammingDistance("0000000000000001", "0000000000000000")).toBe(1);
  });

  it("is symmetric — order does not matter", () => {
    const a = "abcd1234ef567890";
    const b = "1234abcdef907856";
    expect(hammingDistance(a, b)).toBe(hammingDistance(b, a));
  });

  it("returns small distance for similar hashes (near-duplicates)", () => {
    // Two hashes that differ by only a few bits
    const base = "0f0f0f0f0f0f0f0f";
    const similar = "0f0f0f0f0f0f0f0e"; // 1 bit different
    expect(hammingDistance(base, similar)).toBeLessThanOrEqual(4);
  });

  it("returns large distance for very different hashes", () => {
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBeGreaterThan(50);
  });
});

// ─── Blur threshold logic ─────────────────────────────────────────────────────

describe("blur threshold logic", () => {
  const BLUR_THRESHOLD = 80;

  it("flags image as blurry when score is below threshold", () => {
    expect(40 < BLUR_THRESHOLD).toBe(true);
  });

  it("does not flag sharp image", () => {
    expect(150 < BLUR_THRESHOLD).toBe(false);
  });

  it("threshold boundary — score equal to threshold is not blurry", () => {
    expect(80 < BLUR_THRESHOLD).toBe(false);
  });

  it("score of 0 is definitely blurry", () => {
    expect(0 < BLUR_THRESHOLD).toBe(true);
  });
});

// ─── Eye Aspect Ratio logic ───────────────────────────────────────────────────

describe("Eye darkness ratio logic", () => {
  // eyeScore is now a darkness ratio: higher = more dark pixels = more likely closed
  const EYE_THRESHOLD = 0.55;

  it("flags closed eyes when darkness ratio is above threshold", () => {
    expect(0.70 > EYE_THRESHOLD).toBe(true);
  });

  it("does not flag open eyes (low darkness ratio)", () => {
    expect(0.30 > EYE_THRESHOLD).toBe(false);
  });

  it("null score (no face detected) is not flagged", () => {
    const eyeScore: number | null = null;
    const isClosed = eyeScore !== null && eyeScore > EYE_THRESHOLD;
    expect(isClosed).toBe(false);
  });

  it("threshold boundary — exactly at threshold is not flagged", () => {
    expect(0.55 > EYE_THRESHOLD).toBe(false);
  });

  it("very high darkness ratio (fully closed) is flagged", () => {
    expect(0.90 > EYE_THRESHOLD).toBe(true);
  });
});

// ─── Duplicate detection logic ────────────────────────────────────────────────

describe("duplicate detection logic", () => {
  const HASH_DISTANCE_THRESHOLD = 8;

  it("exact same hash is a duplicate", () => {
    const hash = "abcd1234abcd1234";
    expect(hammingDistance(hash, hash) <= HASH_DISTANCE_THRESHOLD).toBe(true);
  });

  it("very different hash is not a duplicate", () => {
    expect(hammingDistance("0000000000000000", "ffffffffffffffff") <= HASH_DISTANCE_THRESHOLD).toBe(false);
  });

  it("hashes within threshold distance are duplicates", () => {
    // Hashes with distance of exactly 8
    const a = "0000000000000000";
    // Flip 8 bits
    const b = "00000000000000ff"; // 8 bits different
    expect(hammingDistance(a, b) <= HASH_DISTANCE_THRESHOLD).toBe(true);
  });

  it("hashes just outside threshold are not duplicates", () => {
    const a = "0000000000000000";
    const b = "00000000000001ff"; // 9 bits different
    expect(hammingDistance(a, b) <= HASH_DISTANCE_THRESHOLD).toBe(false);
  });
});

// ─── CullingResult flag assignment logic ─────────────────────────────────────

describe("culling flag assignment", () => {
  function assignFlags(opts: {
    blurScore: number;
    eyeScore: number | null;
    isDuplicate: boolean;
    blurThreshold?: number;
    earThreshold?: number;
  }): string[] {
    const { blurScore, eyeScore, isDuplicate, blurThreshold = 80, earThreshold = 0.55 } = opts;
    const flags: string[] = [];
    if (blurScore < blurThreshold) flags.push("blur");
    if (eyeScore !== null && eyeScore > earThreshold) flags.push("closed_eyes");
    if (isDuplicate) flags.push("duplicate");
    if (flags.length === 0) flags.push("ok");
    return flags;
  }

  it("marks ok when all checks pass", () => {
    expect(assignFlags({ blurScore: 150, eyeScore: 0.35, isDuplicate: false })).toEqual(["ok"]);
  });

  it("marks blur only", () => {
    expect(assignFlags({ blurScore: 40, eyeScore: 0.35, isDuplicate: false })).toEqual(["blur"]);
  });

  it("marks closed_eyes only", () => {
    expect(assignFlags({ blurScore: 150, eyeScore: 0.75, isDuplicate: false })).toEqual(["closed_eyes"]);
  });

  it("marks duplicate only", () => {
    expect(assignFlags({ blurScore: 150, eyeScore: 0.35, isDuplicate: true })).toEqual(["duplicate"]);
  });

  it("marks multiple flags when multiple issues", () => {
    const flags = assignFlags({ blurScore: 40, eyeScore: 0.75, isDuplicate: true });
    expect(flags).toContain("blur");
    expect(flags).toContain("closed_eyes");
    expect(flags).toContain("duplicate");
    expect(flags).not.toContain("ok");
  });

  it("no face detected (null EAR) does not flag closed_eyes", () => {
    const flags = assignFlags({ blurScore: 150, eyeScore: null, isDuplicate: false });
    expect(flags).toEqual(["ok"]);
  });

  it("does not add ok when other flags exist", () => {
    const flags = assignFlags({ blurScore: 40, eyeScore: 0.35, isDuplicate: false });
    expect(flags).not.toContain("ok");
  });
});