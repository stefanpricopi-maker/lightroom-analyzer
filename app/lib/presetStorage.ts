import type { LightroomResult } from "@/app/lib/types";
import { generateThumbnail as generateThumbnailFromUtils } from "@/app/lib/imageUtils";

export interface SavedPreset {
  id: string;
  name: string;
  collection: string; // collection name, default "Uncategorized"
  thumbnail: string;
  result: LightroomResult;
  savedAt: number;
}

export interface Collection {
  name: string;
  createdAt: number;
}

const PRESETS_KEY = "lr-analyzer-presets";
const COLLECTIONS_KEY = "lr-analyzer-collections";

const DEFAULT_COLLECTION = "Uncategorized";

// ── Presets ──────────────────────────────────────────────────────────────────

export function loadPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    const presets: SavedPreset[] = raw ? JSON.parse(raw) : [];
    // Migrate old presets that don't have a collection field
    return presets.map((p) => ({ ...p, collection: p.collection ?? DEFAULT_COLLECTION }));
  } catch {
    return [];
  }
}

export function savePreset(preset: SavedPreset): void {
  const presets = loadPresets();
  presets.unshift(preset);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function updatePreset(id: string, changes: Partial<SavedPreset>): void {
  const presets = loadPresets().map((p) => p.id === id ? { ...p, ...changes } : p);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function deletePreset(id: string): void {
  const presets = loadPresets().filter((p) => p.id !== id);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

// ── Collections ──────────────────────────────────────────────────────────────

export function loadCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCollection(name: string): void {
  const cols = loadCollections();
  if (!cols.find((c) => c.name === name)) {
    cols.push({ name, createdAt: Date.now() });
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(cols));
  }
}

export function deleteCollection(name: string): void {
  // Move presets in this collection to Uncategorized
  const presets = loadPresets().map((p) =>
    p.collection === name ? { ...p, collection: DEFAULT_COLLECTION } : p
  );
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  const cols = loadCollections().filter((c) => c.name !== name);
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(cols));
}

export function getAllCollectionNames(presets: SavedPreset[], collections: Collection[]): string[] {
  const fromPresets = [...new Set(presets.map((p) => p.collection))];
  const fromCollections = collections.map((c) => c.name);
  const all = [...new Set([DEFAULT_COLLECTION, ...fromCollections, ...fromPresets])];
  return all;
}

export const DEFAULT_COLLECTION_NAME = DEFAULT_COLLECTION;

// ── Thumbnail ────────────────────────────────────────────────────────────────

export function generateThumbnail(imageSrc: string): Promise<string> {
  return generateThumbnailFromUtils(imageSrc);
}