"use client";

import { useRef, useCallback, useState } from "react";
import { useBatch } from "@/app/lib/batchContext";
import { useBatchQueue } from "@/app/lib/useBatchQueue";
import { HeroRecommendationBadge } from "@/app/components/ui/HeroRecommendation";
import { CullingPanel } from "@/app/components/ui/CullingPanel";
import type { BatchItem, SceneGroup } from "@/app/lib/batchTypes";
import type { LightroomResult } from "@/app/lib/types";
import { compressToBase64, generateThumbnail } from "@/app/lib/imageUtils";
import { BatchItemRow } from "@/app/components/batch/BatchItemRow";

async function analyzeHeroImage(base64: string, mime: string): Promise<LightroomResult> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
  });
  if (!res.ok) throw new Error("API error");
  return res.json();
}

export function SceneGroupCard({
  group,
  allGroups,
  isRunning,
  onPreview,
}: {
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

  const handleBatchFiles = useCallback(
    async (files: FileList) => {
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!imageFiles.length) return;
      const newItems = await Promise.all(
        imageFiles.map(async (file) => ({
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          thumbnail: await generateThumbnail(file),
          status: "waiting" as const,
        }))
      );
      dispatch({ type: "ADD_ITEMS", groupId: group.id, items: newItems });
    },
    [dispatch, group.id]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files) handleBatchFiles(e.dataTransfer.files);
    },
    [handleBatchFiles]
  );

  const saveName = () => {
    dispatch({ type: "RENAME_GROUP", groupId: group.id, name: nameValue.trim() || group.name });
    setEditingName(false);
  };

  // Summary line
  const summary = [`${totalCnt} photo${totalCnt !== 1 ? "s" : ""}`, group.heroStatus === "done" ? "Style set ✓" : "No style set", doneCnt > 0 ? `${doneCnt} processed` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Group header */}
      <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: "var(--border-2)", background: "var(--surface-2)" }}>
        <button
          onClick={() => dispatch({ type: "TOGGLE_GROUP_COLLAPSED", groupId: group.id })}
          className="text-[12px] transition-transform inline-block"
          style={{ color: "var(--text-4)", transform: group.collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        >
          ▾
        </button>

        {/* Editable name */}
        {editingName ? (
          <input
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") setEditingName(false);
            }}
            className="flex-1 font-syne font-bold text-[14px] outline-none border-b"
            style={{ background: "transparent", color: "var(--text-1)", borderColor: "var(--accent)" }}
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex-1 text-left font-syne font-bold text-[14px] hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-1)" }}
          >
            {group.name}
          </button>
        )}

        <span className="font-mono text-[10px]" style={{ color: "var(--text-3)" }}>
          {summary}
        </span>

        {allGroups.length > 1 && (
          <button
            onClick={() => dispatch({ type: "REMOVE_GROUP", groupId: group.id })}
            className="font-mono text-[10px] px-2 py-1 rounded transition-colors hover:opacity-60"
            style={{ color: "var(--text-4)" }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Collapsible body */}
      {!group.collapsed && (
        <div className="p-4 space-y-4">
          {/* Hero + batch upload side by side */}
          <div className="grid grid-cols-2 gap-3">
            {/* Hero */}
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-4)" }}>
                Hero Shot
              </p>
              <div
                className="relative rounded-xl overflow-hidden cursor-pointer"
                style={{
                  aspectRatio: "4/3",
                  outline: group.heroImage ? "1px solid var(--border)" : "1px dashed var(--border)",
                  background: "var(--surface-2)",
                }}
                onClick={() => heroInputRef.current?.click()}
              >
                {group.heroImage ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={group.heroImage} alt="Hero" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all flex items-center justify-center group">
                      <span className="font-mono text-[9px] text-white opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-1 rounded-full">Change</span>
                    </div>
                    {group.heroStatus === "done" && (
                      <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded font-mono text-[8px]" style={{ background: "rgba(22,163,74,0.9)", color: "white" }}>
                        ✓
                      </div>
                    )}
                    {group.heroStatus === "analyzing" && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <span className="text-xl" style={{ color: "var(--text-4)" }}>
                      ★
                    </span>
                    <p className="font-mono text-[9px]" style={{ color: "var(--text-4)" }}>
                      Hero shot
                    </p>
                  </div>
                )}
              </div>
              <input ref={heroInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleHeroFile(e.target.files[0])} />
              <button
                disabled={!group.heroImage || group.heroStatus === "analyzing" || group.heroStatus === "done"}
                onClick={analyzeHero}
                className="w-full mt-2 py-1.5 font-mono text-[9px] uppercase tracking-wider rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--text-1)", color: "var(--bg)" }}
              >
                {group.heroStatus === "done" ? "✓ Style ready" : group.heroStatus === "analyzing" ? "Analyzing…" : "Extract Style"}
              </button>
            </div>

            {/* Batch drop */}
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-4)" }}>
                Photos <span style={{ color: "var(--text-4)" }}>({totalCnt})</span>
              </p>
              <div
                className="rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all"
                style={{
                  aspectRatio: "4/3",
                  outline: dragging ? `2px solid var(--accent)` : `1px dashed var(--border)`,
                  background: dragging ? "color-mix(in srgb, var(--accent) 5%, var(--surface))" : "var(--surface-2)",
                }}
                onClick={() => batchInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <span className="text-xl mb-1" style={{ color: "var(--text-4)" }}>
                  ⊞
                </span>
                <p className="font-mono text-[9px] text-center px-2" style={{ color: "var(--text-4)" }}>
                  Drop photos or{" "}
                  <span style={{ color: "var(--accent)" }} className="underline">
                    browse
                  </span>
                </p>
              </div>
              <input ref={batchInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleBatchFiles(e.target.files)} />
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
                  canvas.width = img.width;
                  canvas.height = img.height;
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
                <button onClick={() => dispatch({ type: "CLEAR_GROUP_ITEMS", groupId: group.id })} className="font-mono text-[9px]" style={{ color: "var(--text-4)" }}>
                  Clear all
                </button>
              </div>
              {group.items.map((item) => (
                <BatchItemRow
                  key={item.id}
                  item={item}
                  group={group}
                  allGroups={allGroups}
                  isRunning={isRunning}
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

