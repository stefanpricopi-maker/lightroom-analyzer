import { describe, it, expect, beforeEach } from "vitest";
import {
  loadPresets, savePreset, deletePreset, updatePreset,
  loadCollections, saveCollection, deleteCollection,
  getAllCollectionNames, DEFAULT_COLLECTION_NAME,
} from "@/app/lib/presetStorage";
import type { LightroomResult } from "@/app/lib/types";

const mockResult: LightroomResult = {
  style_summary: "Moody street edit",
  confidence: "high",
  light: { exposure: -0.3, contrast: 15, highlights: -40, shadows: 30, whites: -20, blacks: -50 },
  color: { temperature: 4800, tint: -3, vibrance: 10, saturation: -10 },
  tone_curve: { description: "Flat", highlights: 0, lights: 0, darks: 0, shadows: 0 },
  hsl: {
    hue: { red: 0, orange: 0, yellow: 0, green: 0, aqua: 0, blue: 0, purple: 0, magenta: 0 },
    saturation: { red: 0, orange: 0, yellow: 0, green: 0, aqua: 0, blue: 0, purple: 0, magenta: 0 },
    luminance: { red: 0, orange: 0, yellow: 0, green: 0, aqua: 0, blue: 0, purple: 0, magenta: 0 },
  },
  detail: { sharpening: 40, noise_reduction: 0, color_noise_reduction: 25 },
  effects: { vignette_amount: -20, vignette_midpoint: 50, grain_amount: 15, grain_size: 25, grain_roughness: 50 },
  color_grading: { shadows_hue: 0, shadows_saturation: 0, midtones_hue: 0, midtones_saturation: 0, highlights_hue: 0, highlights_saturation: 0, blending: 50, balance: 0 },
  calibration: { shadows_hue: 0, red_hue: 0, red_saturation: 0, green_hue: 0, green_saturation: 0, blue_hue: 0, blue_saturation: 0 },
};

const makePreset = (id: string, name: string, collection = DEFAULT_COLLECTION_NAME) => ({
  id,
  name,
  collection,
  thumbnail: "data:image/jpeg;base64,abc",
  result: mockResult,
  savedAt: Date.now(),
});

beforeEach(() => {
  localStorage.clear();
});

describe("loadPresets", () => {
  it("returns empty array when nothing saved", () => {
    expect(loadPresets()).toEqual([]);
  });

  it("returns saved presets", () => {
    savePreset(makePreset("1", "Portrait Edit"));
    const presets = loadPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe("Portrait Edit");
  });

  it("migrates old presets without collection field", () => {
    const oldPreset = { id: "1", name: "Old", thumbnail: "", result: mockResult, savedAt: Date.now() };
    localStorage.setItem("lr-analyzer-presets", JSON.stringify([oldPreset]));
    const presets = loadPresets();
    expect(presets[0].collection).toBe(DEFAULT_COLLECTION_NAME);
  });
});

describe("savePreset", () => {
  it("adds preset to the front of the list", () => {
    savePreset(makePreset("1", "First"));
    savePreset(makePreset("2", "Second"));
    const presets = loadPresets();
    expect(presets[0].name).toBe("Second");
    expect(presets[1].name).toBe("First");
  });

  it("persists multiple presets", () => {
    savePreset(makePreset("1", "A"));
    savePreset(makePreset("2", "B"));
    savePreset(makePreset("3", "C"));
    expect(loadPresets()).toHaveLength(3);
  });
});

describe("deletePreset", () => {
  it("removes the correct preset", () => {
    savePreset(makePreset("1", "Keep"));
    savePreset(makePreset("2", "Delete me"));
    deletePreset("2");
    const presets = loadPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe("Keep");
  });

  it("does nothing if id not found", () => {
    savePreset(makePreset("1", "Keep"));
    deletePreset("999");
    expect(loadPresets()).toHaveLength(1);
  });
});

describe("updatePreset", () => {
  it("updates the collection of a preset", () => {
    savePreset(makePreset("1", "My Preset", "Uncategorized"));
    updatePreset("1", { collection: "Wedding" });
    expect(loadPresets()[0].collection).toBe("Wedding");
  });

  it("updates the name of a preset", () => {
    savePreset(makePreset("1", "Old Name"));
    updatePreset("1", { name: "New Name" });
    expect(loadPresets()[0].name).toBe("New Name");
  });
});

describe("collections", () => {
  it("starts empty", () => {
    expect(loadCollections()).toEqual([]);
  });

  it("saves a collection", () => {
    saveCollection("Wedding");
    expect(loadCollections()).toHaveLength(1);
    expect(loadCollections()[0].name).toBe("Wedding");
  });

  it("does not save duplicate collections", () => {
    saveCollection("Wedding");
    saveCollection("Wedding");
    expect(loadCollections()).toHaveLength(1);
  });

  it("deletes a collection and moves presets to Uncategorized", () => {
    saveCollection("Street");
    savePreset(makePreset("1", "Street Preset", "Street"));
    deleteCollection("Street");
    expect(loadCollections()).toHaveLength(0);
    expect(loadPresets()[0].collection).toBe(DEFAULT_COLLECTION_NAME);
  });
});

describe("getAllCollectionNames", () => {
  it("always includes Uncategorized", () => {
    const names = getAllCollectionNames([], []);
    expect(names).toContain(DEFAULT_COLLECTION_NAME);
  });

  it("includes collections from both presets and collection list", () => {
    const presets = [makePreset("1", "A", "Wedding"), makePreset("2", "B", "Travel")];
    const collections = [{ name: "Portrait", createdAt: Date.now() }];
    const names = getAllCollectionNames(presets, collections);
    expect(names).toContain("Wedding");
    expect(names).toContain("Travel");
    expect(names).toContain("Portrait");
    expect(names).toContain(DEFAULT_COLLECTION_NAME);
  });

  it("deduplicates collection names", () => {
    const presets = [makePreset("1", "A", "Wedding"), makePreset("2", "B", "Wedding")];
    const names = getAllCollectionNames(presets, []);
    expect(names.filter((n) => n === "Wedding")).toHaveLength(1);
  });
});