"use client";

import { useCallback, useRef, useState } from "react";
import { useBatch } from "@/app/lib/batchContext";
import { mergeHeroWithPhoto } from "@/app/lib/batchMerge";
import { extractExif, readFileAsBuffer } from "@/app/lib/exif";
import type { LightroomResult } from "@/app/lib/types";
import type { BatchItem, SceneGroup } from "@/app/lib/batchTypes";

const CONCURRENCY = 3;

function buildExifHint(file: File): Promise<string> {
  return readFileAsBuffer(file).then((buf) => {
    const exif = extractExif(buf);
    const parts: string[] = [];
    if (exif.iso)          parts.push(exif.iso);
    if (exif.aperture)     parts.push(exif.aperture);
    if (exif.shutterSpeed) parts.push(exif.shutterSpeed);
    if (exif.focalLength)  parts.push(exif.focalLength);
    return parts.join(", ");
  }).catch(() => "");
}

async function compressToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const MAX_DIM = 2400;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
        else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
      }
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve({ base64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1], mime: "image/jpeg" });
    };
    img.src = url;
  });
}

async function callBatchAnalyze(base64: string, mime: string, exifHint: string) {
  const res = await fetch("/api/batch-analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType: mime, exifHint }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json() as Promise<{
    exposure: number; contrast: number; highlights: number;
    shadows: number; whites: number; blacks: number; reasoning: string;
  }>;
}

export interface QueueStats {
  totalGroups: number;
  totalItems: number;
  done: number;
  errors: number;
  running: number;
  waiting: number;
  progressPercent: number;
}

export function useBatchQueue() {
  const { state, dispatch } = useBatch();
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef(false);

  // Aggregate stats across all groups
  const stats: QueueStats = (() => {
    const allItems = state.groups.flatMap((g) => g.items);
    const done = allItems.filter((i) => i.status === "done").length;
    const errors = allItems.filter((i) => i.status === "error").length;
    const running = allItems.filter((i) => i.status === "analyzing").length;
    const waiting = allItems.filter((i) => i.status === "waiting").length;
    const total = allItems.length;
    return {
      totalGroups: state.groups.length,
      totalItems: total,
      done, errors, running, waiting,
      progressPercent: total === 0 ? 0 : Math.round(((done + errors) / total) * 100),
    };
  })();

  // Process a single item within its group
  const processItem = useCallback(async (
    item: BatchItem,
    group: SceneGroup,
  ) => {
    if (!group.heroResult) return;
    dispatch({ type: "SET_ITEM_STATUS", groupId: group.id, itemId: item.id, status: "analyzing" });
    try {
      const [{ base64, mime }, exifHint] = await Promise.all([
        compressToBase64(item.file),
        buildExifHint(item.file),
      ]);
      const lightResult = await callBatchAnalyze(base64, mime, exifHint);
      const photoResult: LightroomResult = {
        ...group.heroResult,
        style_summary: lightResult.reasoning,
        confidence: "high",
        light: {
          exposure: lightResult.exposure,
          contrast: lightResult.contrast,
          highlights: lightResult.highlights,
          shadows: lightResult.shadows,
          whites: lightResult.whites,
          blacks: lightResult.blacks,
        },
      };
      const merged = mergeHeroWithPhoto(group.heroResult, photoResult);
      dispatch({ type: "SET_ITEM_RESULT", groupId: group.id, itemId: item.id, result: photoResult, merged });
    } catch (err) {
      dispatch({ type: "SET_ITEM_STATUS", groupId: group.id, itemId: item.id, status: "error", error: err instanceof Error ? err.message : "Analysis failed" });
    }
  }, [dispatch]);

  // Start queue — processes all waiting items across all groups that have a hero
  const startQueue = useCallback(async () => {
    if (isRunning) return;
    abortRef.current = false;
    setIsRunning(true);

    // Collect all waiting items paired with their group
    type WorkItem = { item: BatchItem; group: SceneGroup };
    const workItems: WorkItem[] = state.groups
      .filter((g) => g.heroResult) // only groups with hero ready
      .flatMap((g) => g.items.filter((i) => i.status === "waiting").map((item) => ({ item, group: g })));

    let index = 0;
    async function worker() {
      while (index < workItems.length) {
        if (abortRef.current) break;
        const { item, group } = workItems[index++];
        // Re-read group from state to get latest heroResult
        const currentGroup = state.groups.find((g) => g.id === group.id) ?? group;
        await processItem(item, currentGroup);
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, workItems.length) }, () => worker());
    await Promise.all(workers);
    setIsRunning(false);
  }, [state.groups, isRunning, processItem]);

  // Retry a single failed item in its group
  const retryItem = useCallback(async (groupId: string, itemId: string) => {
    const group = state.groups.find((g) => g.id === groupId);
    const item = group?.items.find((i) => i.id === itemId);
    if (!group || !item) return;
    dispatch({ type: "SET_ITEM_STATUS", groupId, itemId, status: "waiting" });
    await processItem({ ...item, status: "waiting" }, group);
  }, [state.groups, dispatch, processItem]);

  const stopQueue = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
  }, []);

  return { startQueue, stopQueue, retryItem, isRunning, stats };
}