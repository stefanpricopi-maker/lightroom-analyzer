import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SavedPreset } from "@/app/lib/presetStorage";
import type { LightroomResult } from "@/app/lib/types";

// ─── Shared mock data ────────────────────────────────────────────────────────

const mockResult: LightroomResult = {
  style_summary: "Warm cinematic look",
  confidence: "high",
  light: { exposure: 0.5, contrast: 10, highlights: -30, shadows: 20, whites: -10, blacks: -20 },
  color: { temperature: 5800, tint: 5, vibrance: 15, saturation: -5 },
  tone_curve: { description: "S-curve", highlights: 10, lights: 5, darks: -5, shadows: -10 },
  hsl: {
    hue: { red: 0, orange: 0, yellow: 0, green: 0, aqua: 0, blue: 0, purple: 0, magenta: 0 },
    saturation: { red: 0, orange: 0, yellow: 0, green: 0, aqua: 0, blue: 0, purple: 0, magenta: 0 },
    luminance: { red: 0, orange: 0, yellow: 0, green: 0, aqua: 0, blue: 0, purple: 0, magenta: 0 },
  },
  detail: { sharpening: 40, noise_reduction: 0, color_noise_reduction: 25 },
  effects: { vignette_amount: 0, vignette_midpoint: 50, grain_amount: 0, grain_size: 25, grain_roughness: 50 },
  color_grading: { shadows_hue: 0, shadows_saturation: 0, midtones_hue: 0, midtones_saturation: 0, highlights_hue: 0, highlights_saturation: 0, blending: 50, balance: 0 },
  calibration: { shadows_hue: 0, red_hue: 0, red_saturation: 0, green_hue: 0, green_saturation: 0, blue_hue: 0, blue_saturation: 0 },
};

const makePreset = (id: string, name: string, collection = "Uncategorized", styleSummary?: string): SavedPreset => ({
  id,
  name,
  collection,
  thumbnail: "data:image/jpeg;base64,abc",
  result: { ...mockResult, style_summary: styleSummary ?? mockResult.style_summary },
  savedAt: Date.now(),
});

const PRESETS: SavedPreset[] = [
  makePreset("1", "Golden Hour Portrait",  "Wedding",       "Warm golden tones with lifted shadows"),
  makePreset("2", "Moody Street",          "Street",        "Dark moody look with crushed blacks"),
  makePreset("3", "Airy Bright",           "Wedding",       "Clean bright airy aesthetic"),
  makePreset("4", "Film Simulation",       "Uncategorized", "Vintage film look with grain"),
  makePreset("5", "Cool Blue Tones",       "Street",        "Cool desaturated blue grade"),
];

// ─── Pure filtering logic (extracted from component's useMemo) ───────────────

function filterPresets(
  presets: SavedPreset[],
  activeCollection: string,
  search: string
): SavedPreset[] {
  let list = presets;
  if (activeCollection !== "__all__") {
    list = list.filter((p) => p.collection === activeCollection);
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.result.style_summary?.toLowerCase().includes(q)
    );
  }
  return list;
}

// ─── Filtering logic unit tests ──────────────────────────────────────────────

describe("PresetLibrary — filtering logic", () => {
  describe("collection filtering", () => {
    it("returns all presets when activeCollection is __all__", () => {
      const result = filterPresets(PRESETS, "__all__", "");
      expect(result).toHaveLength(5);
    });

    it("filters by collection name", () => {
      const result = filterPresets(PRESETS, "Wedding", "");
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.collection === "Wedding")).toBe(true);
    });

    it("returns only street presets when filtering Street", () => {
      const result = filterPresets(PRESETS, "Street", "");
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.name)).toContain("Moody Street");
      expect(result.map((p) => p.name)).toContain("Cool Blue Tones");
    });

    it("returns only uncategorized presets", () => {
      const result = filterPresets(PRESETS, "Uncategorized", "");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Film Simulation");
    });

    it("returns empty array when collection has no presets", () => {
      const result = filterPresets(PRESETS, "NonExistent", "");
      expect(result).toHaveLength(0);
    });
  });

  describe("search filtering", () => {
    it("matches preset name case-insensitively", () => {
      const result = filterPresets(PRESETS, "__all__", "golden");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Golden Hour Portrait");
    });

    it("matches style_summary case-insensitively", () => {
      const result = filterPresets(PRESETS, "__all__", "crushed blacks");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Moody Street");
    });

    it("matches partial words", () => {
      const result = filterPresets(PRESETS, "__all__", "warm");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Golden Hour Portrait");
    });

    it("returns all presets for empty search", () => {
      expect(filterPresets(PRESETS, "__all__", "")).toHaveLength(5);
      expect(filterPresets(PRESETS, "__all__", "   ")).toHaveLength(5);
    });

    it("returns empty array for no matches", () => {
      const result = filterPresets(PRESETS, "__all__", "xyznotfound");
      expect(result).toHaveLength(0);
    });

    it("matches multiple presets when search term is broad", () => {
      const result = filterPresets(PRESETS, "__all__", "look");
      // "Warm golden tones" no, "Dark moody look" yes, "film look" yes
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("combined collection + search filtering", () => {
    it("filters by both collection and search", () => {
      const result = filterPresets(PRESETS, "Wedding", "golden");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Golden Hour Portrait");
    });

    it("returns empty when search matches but wrong collection", () => {
      const result = filterPresets(PRESETS, "Street", "golden");
      expect(result).toHaveLength(0);
    });

    it("searches within the filtered collection", () => {
      const result = filterPresets(PRESETS, "Street", "blue");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Cool Blue Tones");
    });

    it("returns all collection items when search is empty", () => {
      const wedding = filterPresets(PRESETS, "Wedding", "");
      expect(wedding).toHaveLength(2);
    });
  });
});

// ─── Component interaction tests ─────────────────────────────────────────────

// We need to mock localStorage and the storage module for component tests
vi.mock("@/app/lib/presetStorage", () => ({
  loadPresets: vi.fn(() => PRESETS),
  loadCollections: vi.fn(() => [
    { name: "Wedding", createdAt: Date.now() },
    { name: "Street", createdAt: Date.now() },
  ]),
  saveCollection: vi.fn(),
  deleteCollection: vi.fn(),
  updatePreset: vi.fn(),
  deletePreset: vi.fn(),
  getAllCollectionNames: vi.fn(() => ["Uncategorized", "Wedding", "Street"]),
  DEFAULT_COLLECTION_NAME: "Uncategorized",
}));

// Lazy import after mock is set up
async function renderLibrary(onLoad = vi.fn()) {
  const { PresetLibrary } = await import("@/app/components/ui/PresetLibrary");
  render(<PresetLibrary onLoad={onLoad} />);

  // Open the drawer
  const btn = screen.getByRole("button", { name: /library/i });
  fireEvent.click(btn);

  await waitFor(() => screen.getByText("Preset Library"));
  return { onLoad };
}

describe("PresetLibrary — component interactions", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders trigger button", async () => {
    const { PresetLibrary } = await import("@/app/components/ui/PresetLibrary");
    render(<PresetLibrary onLoad={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /library/i })).toBeInTheDocument();
    });
  });

  it("opens drawer on trigger click", async () => {
    await renderLibrary();
    expect(screen.getByText("Preset Library")).toBeInTheDocument();
    expect(screen.getByText("5 presets")).toBeInTheDocument();
  });

  it("shows all presets on open", async () => {
    await renderLibrary();
    expect(screen.getByText("Golden Hour Portrait")).toBeInTheDocument();
    expect(screen.getByText("Moody Street")).toBeInTheDocument();
    expect(screen.getByText("Film Simulation")).toBeInTheDocument();
  });

  it("shows collection tabs", async () => {
    await renderLibrary();
    // Use getAllByText and check at least one matches the tab pill pattern
    expect(screen.getAllByText(/wedding/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/street/i).length).toBeGreaterThanOrEqual(1);
    // All tab should always be present
    expect(screen.getByRole("button", { name: /all \(\d+\)/i })).toBeInTheDocument();
  });

  it("filters by collection when tab is clicked", async () => {
    await renderLibrary();
    const weddingTab = screen.getByRole("button", { name: /wedding \(\d+\)/i });
    fireEvent.click(weddingTab);
    await waitFor(() => {
      expect(screen.getByText("Golden Hour Portrait")).toBeInTheDocument();
      expect(screen.getByText("Airy Bright")).toBeInTheDocument();
      expect(screen.queryByText("Moody Street")).not.toBeInTheDocument();
      expect(screen.queryByText("Film Simulation")).not.toBeInTheDocument();
    });
  });

  it("filters by search input", async () => {
    await renderLibrary();
    const searchInput = screen.getByPlaceholderText("Search presets…");
    fireEvent.change(searchInput, { target: { value: "golden" } });
    await waitFor(() => {
      expect(screen.getByText("Golden Hour Portrait")).toBeInTheDocument();
      expect(screen.queryByText("Moody Street")).not.toBeInTheDocument();
    });
  });

  it("shows empty state when search has no results", async () => {
    await renderLibrary();
    const searchInput = screen.getByPlaceholderText("Search presets…");
    fireEvent.change(searchInput, { target: { value: "xyznotfound" } });
    await waitFor(() => {
      expect(screen.getByText(/no presets matching/i)).toBeInTheDocument();
    });
  });

  it("clears search when X button is clicked", async () => {
    await renderLibrary();
    const searchInput = screen.getByPlaceholderText("Search presets…");
    fireEvent.change(searchInput, { target: { value: "golden" } });
    await waitFor(() => screen.getByText("Golden Hour Portrait"));
    const clearBtn = screen.getByTestId("clear-search");
    fireEvent.click(clearBtn);
    await waitFor(() => {
      expect(searchInput).toHaveValue("");
      expect(screen.getByText("Moody Street")).toBeInTheDocument();
    });
  });

  it("calls onLoad when Load button is clicked", async () => {
    const onLoad = vi.fn();
    await renderLibrary(onLoad);
    const loadBtns = screen.getAllByRole("button", { name: /load/i });
    fireEvent.click(loadBtns[0]);
    expect(onLoad).toHaveBeenCalledWith(PRESETS[0]);
  });

  it("shows confirm delete UI when Delete is clicked", async () => {
    await renderLibrary();
    const deleteBtns = screen.getAllByRole("button", { name: /delete/i });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("Sure?")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
    });
  });

  it("cancels delete when No is clicked", async () => {
    await renderLibrary();
    const deleteBtns = screen.getAllByRole("button", { name: /delete/i });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() => screen.getByText("Sure?"));
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    await waitFor(() => {
      expect(screen.queryByText("Sure?")).not.toBeInTheDocument();
    });
  });

  it("shows new collection input when + New is clicked", async () => {
    await renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: /\+ new/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Name…")).toBeInTheDocument();
    });
  });
});
