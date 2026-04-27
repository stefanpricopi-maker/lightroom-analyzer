"use client";

import { useRef, useCallback, useState } from "react";
import { useBatch } from "@/app/lib/batchContext";
import { useBatchQueue } from "@/app/lib/useBatchQueue";
import { exportGroupsZip } from "@/app/lib/batchExport";
import { downloadXMP } from "@/app/lib/xmp";
import { BatchPreviewModal } from "@/app/components/ui/BatchPreviewModal";
import { HeroRecommendationBadge, RecommendedBadge } from "@/app/components/ui/HeroRecommendation";
import { CullingPanel } from "@/app/components/ui/CullingPanel";
import type { BatchItem, SceneGroup } from "@/app/lib/batchTypes";
import type { LightroomResult } from "@/app/lib/types";
import { SmartCluster } from "@/app/components/ui/SmartCluster";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const size = 120; canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const min = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = url;
  });
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

async function analyzeHeroImage(base64: string, mime: string): Promise<LightroomResult> {
  const res = await fetch("/api/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
  });
  if (!res.ok) throw new Error("API error");
  return res.json();
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BatchItem["status"] }) {
  const cfg = {
    waiting:   { label: "Waiting",   color: "var(--text-4)", bg: "var(--border-2)" },
    analyzing: { label: "Analyzing", color: "#c07040",       bg: "rgba(192,112,64,0.1)" },
    done:      { label: "Done",      color: "#16a34a",       bg: "rgba(22,163,74,0.1)" },
    error:     { label: "Error",     color: "#dc2626",       bg: "rgba(220,38,38,0.1)" },
  }[status];
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full flex items-center gap-1"
      style={{ color: cfg.color, background: cfg.bg }}>
      {status === "analyzing" && <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />}
      {cfg.label}
    </span>
  );
}

// ─── Batch item row ───────────────────────────────────────────────────────────

function BatchItemRow({ item, group, allGroups, onRemove, onRetry, onPreview, onMove, isRunning, recommendedId }: {
  item: BatchItem;
  group: SceneGroup;
  allGroups: SceneGroup[];
  onRemove: () => void;
  onRetry: () => void;
  onPreview: () => void;
  onMove: (toGroupId: string) => void;
  isRunning: boolean;
  recommendedId: string | null;
}) {
  const [showMove, setShowMove] = useState(false);
  const otherGroups = allGroups.filter((g) => g.id !== group.id);

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl transition-all relative overflow-hidden"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border-2)" }}>

      {/* Shimmer when analyzing */}
      {item.status === "analyzing" && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent) 8%, transparent) 50%, transparent 100%)",
          backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
        }} />
      )}

      {/* Thumbnail */}
      <div className="relative flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.thumbnail} alt={item.file.name} className="w-10 h-10 object-cover rounded-lg"
          style={{ opacity: item.status === "analyzing" ? 0.6 : 1 }} />
        {item.id === recommendedId && <RecommendedBadge />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[11px] truncate" style={{ color: "var(--text-1)" }}>{item.file.name}</p>
        {item.status === "error" && item.error && (
          <p className="font-mono text-[9px] mt-0.5" style={{ color: "#dc2626" }}>{item.error}</p>
        )}
        {item.status === "done" && item.result?.style_summary && (
          <p className="font-mono text-[9px] mt-0.5 line-clamp-1 italic" style={{ color: "var(--text-3)" }}>
            {item.result.style_summary}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0 relative z-10">
        {group.heroResult && item.status !== "analyzing" && (
          <button onClick={onPreview}
            className="font-mono text-[9px] px-1.5 py-0.5 rounded transition-colors"
            style={{ background: "var(--border-2)", color: "var(--text-3)" }}
            title="Preview color style">◐</button>
        )}
        <StatusBadge status={item.status} />
        {item.status === "done" && item.merged && (
          <button onClick={() => downloadXMP(item.merged!, item.file.name.replace(/\.[^.]+$/, ""))}
            className="font-mono text-[9px] px-1.5 py-0.5 rounded transition-colors"
            style={{ background: "var(--text-1)", color: "var(--bg)" }}>↓</button>
        )}
        {item.status === "error" && (
          <button onClick={onRetry}
            className="font-mono text-[9px] px-1.5 py-0.5 rounded transition-colors"
            style={{ background: "rgba(192,112,64,0.1)", color: "var(--accent)", border: "1px solid var(--accent)" }}>↺</button>
        )}
        {/* Move to group */}
        {otherGroups.length > 0 && item.status !== "analyzing" && (
          <div className="relative">
            <button onClick={() => setShowMove(!showMove)}
              className="font-mono text-[9px] px-1.5 py-0.5 rounded transition-colors"
              style={{ background: "var(--border-2)", color: "var(--text-3)" }}
              title="Move to another group">⇥</button>
            {showMove && (
              <div className="absolute right-0 top-full mt-1 z-50 rounded-lg overflow-hidden shadow-lg"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", minWidth: 140 }}>
                <p className="font-mono text-[9px] uppercase tracking-wider px-3 py-1.5" style={{ color: "var(--text-4)", borderBottom: "1px solid var(--border-2)" }}>Move to</p>
                {otherGroups.map((g) => (
                  <button key={g.id} onClick={() => { onMove(g.id); setShowMove(false); }}
                    className="w-full text-left px-3 py-2 font-mono text-[11px] transition-colors hover:opacity-70"
                    style={{ color: "var(--text-1)" }}>
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {!isRunning && (
          <button onClick={onRemove} className="text-[11px] transition-opacity hover:opacity-60"
            style={{ color: "var(--text-4)" }}>✕</button>
        )}
      </div>
    </div>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ done, errors, total }: { done: number; errors: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round(((done + errors) / total) * 100);
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="font-mono text-[10px]" style={{ color: "var(--text-3)" }}>
          {done}/{total} complete{errors > 0 && <span style={{ color: "#dc2626" }}> · {errors} failed</span>}
        </span>
        <span className="font-mono text-[10px]" style={{ color: "var(--accent)" }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
}

// ─── Scene Group Card ─────────────────────────────────────────────────────────

function SceneGroupCard({ group, allGroups, isRunning, onPreview }: {
  group: SceneGroup;
  allGroups: SceneGroup[];
  isRunning: boolean;
  onPreview: (item: BatchItem, group: SceneGroup) => void;
}) {
  const { dispatch } = useBatch();
  const { retryItem } = useBatchQueue();
  const [recommendedId, setRecommendedId] = useState<string | null>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(group.name);

  const doneCnt = group.items.filter((i) => i.status === "done").length;
  const totalCnt = group.items.length;

  const handleHeroFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const image = URL.createObjectURL(file);
    const { base64, mime } = await compressToBase64(file);
    dispatch({ type: "SET_HERO", groupId: group.id, image, base64, mime });
  };

  const analyzeHero = async () => {
    if (!group.heroBase64 || !group.heroMime) return;
    dispatch({ type: "SET_HERO_STATUS", groupId: group.id, status: "analyzing" });
    try {
      const result = await analyzeHeroImage(group.heroBase64, group.heroMime);
      dispatch({ type: "SET_HERO_RESULT", groupId: group.id, result });
    } catch {
      dispatch({ type: "SET_HERO_STATUS", groupId: group.id, status: "error" });
    }
  };

  const handleBatchFiles = useCallback(async (files: FileList) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) return;
    const newItems = await Promise.all(imageFiles.map(async (file) => ({
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file, thumbnail: await generateThumbnail(file), status: "waiting" as const,
    })));
    dispatch({ type: "ADD_ITEMS", groupId: group.id, items: newItems });
  }, [dispatch, group.id]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files) handleBatchFiles(e.dataTransfer.files);
  }, [handleBatchFiles]);

  const saveName = () => {
    dispatch({ type: "RENAME_GROUP", groupId: group.id, name: nameValue.trim() || group.name });
    setEditingName(false);
  };

  // Summary line
  const summary = [
    `${totalCnt} photo${totalCnt !== 1 ? "s" : ""}`,
    group.heroStatus === "done" ? "Style set ✓" : "No style set",
    doneCnt > 0 ? `${doneCnt} processed` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

      {/* Group header */}
      <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: "var(--border-2)", background: "var(--surface-2)" }}>
        <button onClick={() => dispatch({ type: "TOGGLE_GROUP_COLLAPSED", groupId: group.id })}
          className="text-[12px] transition-transform inline-block"
          style={{ color: "var(--text-4)", transform: group.collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          ▾
        </button>

        {/* Editable name */}
        {editingName ? (
          <input autoFocus value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
            className="flex-1 font-syne font-bold text-[14px] outline-none border-b"
            style={{ background: "transparent", color: "var(--text-1)", borderColor: "var(--accent)" }} />
        ) : (
          <button onClick={() => setEditingName(true)}
            className="flex-1 text-left font-syne font-bold text-[14px] hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-1)" }}>
            {group.name}
          </button>
        )}

        <span className="font-mono text-[10px]" style={{ color: "var(--text-3)" }}>{summary}</span>

        {allGroups.length > 1 && (
          <button onClick={() => dispatch({ type: "REMOVE_GROUP", groupId: group.id })}
            className="font-mono text-[10px] px-2 py-1 rounded transition-colors hover:opacity-60"
            style={{ color: "var(--text-4)" }}>✕</button>
        )}
      </div>

      {/* Collapsible body */}
      {!group.collapsed && (
        <div className="p-4 space-y-4">

          {/* Hero + batch upload side by side */}
          <div className="grid grid-cols-2 gap-3">
            {/* Hero */}
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-4)" }}>Hero Shot</p>
              <div className="relative rounded-xl overflow-hidden cursor-pointer"
                style={{ aspectRatio: "4/3", outline: group.heroImage ? "1px solid var(--border)" : "1px dashed var(--border)", background: "var(--surface-2)" }}
                onClick={() => heroInputRef.current?.click()}>
                {group.heroImage ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={group.heroImage} alt="Hero" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all flex items-center justify-center group">
                      <span className="font-mono text-[9px] text-white opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-1 rounded-full">Change</span>
                    </div>
                    {group.heroStatus === "done" && (
                      <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded font-mono text-[8px]" style={{ background: "rgba(22,163,74,0.9)", color: "white" }}>✓</div>
                    )}
                    {group.heroStatus === "analyzing" && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <span className="text-xl" style={{ color: "var(--text-4)" }}>★</span>
                    <p className="font-mono text-[9px]" style={{ color: "var(--text-4)" }}>Hero shot</p>
                  </div>
                )}
              </div>
              <input ref={heroInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleHeroFile(e.target.files[0])} />
              <button disabled={!group.heroImage || group.heroStatus === "analyzing" || group.heroStatus === "done"}
                onClick={analyzeHero}
                className="w-full mt-2 py-1.5 font-mono text-[9px] uppercase tracking-wider rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--text-1)", color: "var(--bg)" }}>
                {group.heroStatus === "done" ? "✓ Style ready" : group.heroStatus === "analyzing" ? "Analyzing…" : "Extract Style"}
              </button>
            </div>

            {/* Batch drop */}
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-4)" }}>
                Photos <span style={{ color: "var(--text-4)" }}>({totalCnt})</span>
              </p>
              <div className="rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all"
                style={{
                  aspectRatio: "4/3",
                  outline: dragging ? `2px solid var(--accent)` : `1px dashed var(--border)`,
                  background: dragging ? "color-mix(in srgb, var(--accent) 5%, var(--surface))" : "var(--surface-2)",
                }}
                onClick={() => batchInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}>
                <span className="text-xl mb-1" style={{ color: "var(--text-4)" }}>⊞</span>
                <p className="font-mono text-[9px] text-center px-2" style={{ color: "var(--text-4)" }}>
                  Drop photos or <span style={{ color: "var(--accent)" }} className="underline">browse</span>
                </p>
              </div>
              <input ref={batchInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => e.target.files && handleBatchFiles(e.target.files)} />
            </div>
          </div>

          {/* Hero style summary */}
          {group.heroStatus === "done" && group.heroResult?.style_summary && (
            <div className="px-3 py-2 rounded-lg font-mono text-[10px] italic" style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.15)", color: "var(--text-2)" }}>
              ✓ "{group.heroResult.style_summary}"
            </div>
          )}

          {/* Hero recommendation */}
          {group.items.length >= 2 && group.heroStatus !== "done" && (
            <HeroRecommendationBadge
              items={group.items}
              onAccept={(item) => {
                setRecommendedId(item.id);
                // Set thumbnail as hero preview — user can replace with full-res via the hero upload
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  canvas.width = img.width; canvas.height = img.height;
                  canvas.getContext("2d")!.drawImage(img, 0, 0);
                  const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
                  dispatch({ type: "SET_HERO", groupId: group.id, image: item.thumbnail, base64, mime: "image/jpeg" });
                };
                img.src = item.thumbnail;
              }}
            />
          )}

          {/* AI Culling */}
          {group.items.length >= 2 && (
            <CullingPanel
              items={group.items}
              onUpdateItems={(kept) => {
                // Remove rejected items from the group
                const keptIds = new Set(kept.map((i) => i.id));
                group.items
                  .filter((i) => !keptIds.has(i.id))
                  .forEach((i) => dispatch({ type: "REMOVE_ITEM", groupId: group.id, itemId: i.id }));
              }}
            />
          )}

          {/* Item list */}
          {group.items.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--text-4)" }}>
                  {totalCnt} photo{totalCnt !== 1 ? "s" : ""} · {doneCnt} done
                </p>
                <button onClick={() => dispatch({ type: "CLEAR_GROUP_ITEMS", groupId: group.id })}
                  className="font-mono text-[9px]" style={{ color: "var(--text-4)" }}>Clear all</button>
              </div>
              {group.items.map((item) => (
                <BatchItemRow key={item.id}
                  item={item} group={group} allGroups={allGroups} isRunning={isRunning}
                  onRemove={() => dispatch({ type: "REMOVE_ITEM", groupId: group.id, itemId: item.id })}
                  onRetry={() => retryItem(group.id, item.id)}
                  onPreview={() => onPreview(item, group)}
                  onMove={(toGroupId) => dispatch({ type: "MOVE_ITEM", itemId: item.id, fromGroupId: group.id, toGroupId })}
                  recommendedId={recommendedId}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main BatchTab ────────────────────────────────────────────────────────────

export function BatchTab() {
  const { state, dispatch } = useBatch();
  const { startQueue, stopQueue, isRunning, stats } = useBatchQueue();
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<{ item: BatchItem; group: SceneGroup } | null>(null);

  const handleExportZip = async () => {
    setExporting(true); setExportMsg(null);
    try {
      const summary = await exportGroupsZip(state.groups);
      setExportMsg(`✓ ${summary.exported} presets exported${summary.skipped > 0 ? ` (${summary.skipped} skipped)` : ""}`);
      setTimeout(() => setExportMsg(null), 4000);
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : "Export failed");
      setTimeout(() => setExportMsg(null), 4000);
    }
    setExporting(false);
  };

  const readyGroups = state.groups.filter((g) => g.heroStatus === "done" && g.heroResult);
  const totalWaiting = state.groups.filter((g) => g.heroResult).flatMap((g) => g.items.filter((i) => i.status === "waiting")).length;

  return (
    <div className="space-y-4">

      {/* Global controls bar */}
      <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-syne font-bold text-[15px]" style={{ color: "var(--text-1)" }}>
              Batch Event Mode
            </p>
            <p className="font-mono text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
              {state.groups.length} group{state.groups.length !== 1 ? "s" : ""} ·{" "}
              {stats.totalItems} photos ·{" "}
              {stats.done}/{stats.totalItems} complete
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => dispatch({ type: "ADD_GROUP" })}
              className="font-mono text-[11px] px-3 py-2 rounded-lg transition-colors"
              style={{ background: "var(--border-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
              + Add Scene Group
            </button>

            {isRunning ? (
              <button onClick={stopQueue}
                className="font-mono text-[11px] px-3 py-2 rounded-lg transition-colors"
                style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" }}>
                ◼ Stop
              </button>
            ) : (
              <button disabled={readyGroups.length === 0 || totalWaiting === 0}
                onClick={startQueue}
                className="font-mono text-[11px] px-3 py-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--accent)", color: "white" }}>
                {totalWaiting > 0 ? `▶ Process ${totalWaiting} photo${totalWaiting !== 1 ? "s" : ""}` : "▶ Process All"}
              </button>
            )}

            {stats.done > 0 && (
              <button disabled={exporting || isRunning} onClick={handleExportZip}
                className="font-mono text-[11px] px-3 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                style={{ background: "var(--text-1)", color: "var(--bg)" }}>
                {exporting ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin opacity-60" />Packing…</> : `↓ ZIP (${stats.done})`}
              </button>
            )}
          </div>
        </div>

        {/* Global progress */}
        {stats.totalItems > 0 && (
          <div className="mt-3">
            <ProgressBar done={stats.done} errors={stats.errors} total={stats.totalItems} />
          </div>
        )}

        {exportMsg && (
          <p className="font-mono text-[11px] mt-2" style={{ color: exportMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
            {exportMsg}
          </p>
        )}

        {readyGroups.length === 0 && stats.totalItems > 0 && (
          <p className="font-mono text-[10px] mt-2" style={{ color: "var(--text-4)" }}>
            Extract a hero style for at least one group to enable processing.
          </p>
        )}
      </div>

      {/* Smart Cluster */}
      <SmartCluster allItems={state.groups.flatMap((g) => g.items)} />

      {/* Scene group cards */}
      {state.groups.map((group) => (
        <SceneGroupCard key={group.id} group={group} allGroups={state.groups}
          isRunning={isRunning}
          onPreview={(item, group) => setPreviewState({ item, group })} />
      ))}

      {/* Preview modal */}
      {previewState && previewState.group.heroResult && (
        <BatchPreviewModal
          thumbnail={previewState.item.thumbnail}
          filename={previewState.item.file.name}
          heroResult={previewState.group.heroResult}
          onClose={() => setPreviewState(null)}
        />
      )}
    </div>
  );
}
