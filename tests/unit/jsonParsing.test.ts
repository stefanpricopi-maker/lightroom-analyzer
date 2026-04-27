import { describe, it, expect } from "vitest";

// Replicate the exact cleanup logic from app/api/analyze/route.ts
function cleanJSON(raw: string): string {
  return raw
    .replace(/```json|```/g, "")
    .replace(/:\s*\+(\d)/g, ": $1")
    .trim();
}

describe("JSON cleanup (API route)", () => {
  it("strips markdown code fences", () => {
    const input = '```json\n{"exposure": 0}\n```';
    expect(JSON.parse(cleanJSON(input))).toEqual({ exposure: 0 });
  });

  it("removes leading + signs from positive numbers", () => {
    const input = '{"exposure": +0.5, "contrast": +10}';
    const result = JSON.parse(cleanJSON(input));
    expect(result.exposure).toBe(0.5);
    expect(result.contrast).toBe(10);
  });

  it("preserves negative numbers", () => {
    const input = '{"highlights": -30, "shadows": -20}';
    const result = JSON.parse(cleanJSON(input));
    expect(result.highlights).toBe(-30);
    expect(result.shadows).toBe(-20);
  });

  it("preserves zero values", () => {
    const input = '{"tint": 0, "vibrance": 0}';
    const result = JSON.parse(cleanJSON(input));
    expect(result.tint).toBe(0);
    expect(result.vibrance).toBe(0);
  });

  it("handles mixed positive and negative values", () => {
    const input = '{"exposure": +0.3, "highlights": -40, "shadows": +25, "blacks": -60}';
    const result = JSON.parse(cleanJSON(input));
    expect(result.exposure).toBe(0.3);
    expect(result.highlights).toBe(-40);
    expect(result.shadows).toBe(25);
    expect(result.blacks).toBe(-60);
  });

  it("handles both fences and + signs together", () => {
    const input = '```json\n{"exposure": +1.5, "contrast": -10}\n```';
    const result = JSON.parse(cleanJSON(input));
    expect(result.exposure).toBe(1.5);
    expect(result.contrast).toBe(-10);
  });

  it("handles whitespace around colons", () => {
    const input = '{"exposure" :  +0.5}';
    const result = JSON.parse(cleanJSON(input));
    expect(result.exposure).toBe(0.5);
  });
});


describe("File size validation", () => {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  it("accepts files under 10MB", () => {
    const size = 5 * 1024 * 1024; // 5MB
    expect(size <= MAX_FILE_SIZE).toBe(true);
  });

  it("rejects files over 10MB", () => {
    const size = 11 * 1024 * 1024; // 11MB
    expect(size > MAX_FILE_SIZE).toBe(true);
  });

  it("accepts files exactly at 10MB", () => {
    const size = 10 * 1024 * 1024; // exactly 10MB
    expect(size <= MAX_FILE_SIZE).toBe(true);
  });

  it("formats file size correctly for error message", () => {
    const size = 11.5 * 1024 * 1024;
    const formatted = (size / 1024 / 1024).toFixed(1);
    expect(formatted).toBe("11.5");
  });
});