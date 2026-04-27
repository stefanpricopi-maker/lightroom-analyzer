import JSZip from "jszip";
import { generateXMP, sanitizeFilename } from "@/app/lib/xmp";
import type { BatchItem } from "@/app/lib/batchTypes";

/**
 * Strips the extension from a filename and returns the base name.
 * e.g. "DSC_001.jpg" → "DSC_001"
 * e.g. "my photo.RAW" → "my photo"
 */
export function getBaseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").trim();
}

/**
 * Generates the .xmp sidecar filename matching the original photo name.
 * e.g. "DSC_001.jpg" → "DSC_001.xmp"
 */
export function getSidecarName(filename: string): string {
  return `${getBaseName(filename)}.xmp`;
}

/**
 * Formats today's date as YYYY-MM-DD for the ZIP filename.
 */
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

import type { SceneGroup } from "@/app/lib/batchTypes";

export interface ExportSummary {
  total: number;
  exported: number;
  skipped: number;
  zipName: string;
}

/**
 * Packs all completed batch items into a ZIP archive of .xmp sidecar files.
 * Each XMP filename matches the original photo filename.
 */
export async function exportBatchZip(
  items: BatchItem[],
  presetNamePrefix = ""
): Promise<ExportSummary> {
  const done = items.filter((i) => i.status === "done" && i.merged);
  const skipped = items.length - done.length;

  if (done.length === 0) {
    throw new Error("No completed items to export.");
  }

  const zip = new JSZip();

  for (const item of done) {
    const baseName = getBaseName(item.file.name);
    const presetName = presetNamePrefix
      ? `${presetNamePrefix} — ${baseName}`
      : baseName;

    const xmpContent = generateXMP(item.merged!, presetName);
    const sidecarName = getSidecarName(item.file.name);

    zip.file(sidecarName, xmpContent);
  }

  const zipName = `lightroom-presets-${todayString()}.zip`;
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);

  return { total: items.length, exported: done.length, skipped, zipName };
}

/**
 * Exports all groups into a single ZIP.
 * Files are organized into subfolders named after each group.
 * e.g. Preparations/DSC_001.xmp, Ceremony/DSC_002.xmp
 */
export async function exportGroupsZip(groups: SceneGroup[]): Promise<ExportSummary> {
  const zip = new JSZip();
  let totalExported = 0;
  let totalSkipped = 0;
  let totalItems = 0;

  for (const group of groups) {
    const done = group.items.filter((i) => i.status === "done" && i.merged);
    const skipped = group.items.length - done.length;
    totalItems += group.items.length;
    totalSkipped += skipped;

    if (done.length === 0) continue;

    // Sanitize group name for use as folder name
    const folderName = sanitizeFilename(group.name) || `Group_${group.id.slice(0, 6)}`;
    const folder = zip.folder(folderName)!;

    for (const item of done) {
      const baseName = getBaseName(item.file.name);
      const presetName = `${group.name} — ${baseName}`;
      const xmpContent = generateXMP(item.merged!, presetName);
      folder.file(getSidecarName(item.file.name), xmpContent);
      totalExported++;
    }
  }

  if (totalExported === 0) throw new Error("No completed items to export.");

  const zipName = `lightroom-presets-${todayString()}.zip`;
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);

  return { total: totalItems, exported: totalExported, skipped: totalSkipped, zipName };
}