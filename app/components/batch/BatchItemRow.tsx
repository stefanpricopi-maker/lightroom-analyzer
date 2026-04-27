"use client";

import { useEffect, useRef, useState } from "react";
import { downloadXMP } from "@/app/lib/xmp";
import { RecommendedBadge } from "@/app/components/ui/HeroRecommendation";
import type { BatchItem, SceneGroup } from "@/app/lib/batchTypes";
import { StatusBadge } from "@/app/components/batch/StatusBadge";
import { toast } from "@/app/lib/toast";

export function BatchItemRow({
  item,
  group,
  allGroups,
  onRemove,
  onRetry,
  onPreview,
  onMove,
  isRunning,
  recommendedId,
}: {
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
  const lastToastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (item.status !== "error") return;
    const key = `${item.id}:${item.error ?? ""}`;
    if (lastToastKeyRef.current === key) return;
    lastToastKeyRef.current = key;
    toast.warning(`${item.file.name} failed — click Retry`);
  }, [item.id, item.status, item.error, item.file.name]);

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-xl transition-all relative overflow-hidden"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border-2)" }}
    >
      {/* Shimmer when analyzing */}
      {item.status === "analyzing" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent) 8%, transparent) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s infinite",
          }}
        />
      )}

      {/* Thumbnail */}
      <div className="relative flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbnail}
          alt={item.file.name}
          className="w-10 h-10 object-cover rounded-lg"
          style={{ opacity: item.status === "analyzing" ? 0.6 : 1 }}
        />
        {item.id === recommendedId && <RecommendedBadge />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[11px] truncate" style={{ color: "var(--text-1)" }}>
          {item.file.name}
        </p>
        {item.status === "error" && item.error && (
          <p className="font-mono text-[9px] mt-0.5" style={{ color: "#dc2626" }}>
            {item.error}
          </p>
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
          <button
            onClick={onPreview}
            className="font-mono text-[9px] px-1.5 py-0.5 rounded transition-colors"
            style={{ background: "var(--border-2)", color: "var(--text-3)" }}
            title="Preview color style"
          >
            ◐
          </button>
        )}
        <StatusBadge status={item.status} />
        {item.status === "done" && item.merged && (
          <button
            onClick={() => {
              downloadXMP(item.merged!, item.file.name.replace(/\.[^.]+$/, ""));
              toast.success("XMP preset downloaded");
            }}
            className="font-mono text-[9px] px-1.5 py-0.5 rounded transition-colors"
            style={{ background: "var(--text-1)", color: "var(--bg)" }}
          >
            ↓
          </button>
        )}
        {item.status === "error" && (
          <button
            onClick={onRetry}
            className="font-mono text-[9px] px-1.5 py-0.5 rounded transition-colors"
            style={{ background: "rgba(192,112,64,0.1)", color: "var(--accent)", border: "1px solid var(--accent)" }}
          >
            ↺
          </button>
        )}

        {/* Move to group */}
        {otherGroups.length > 0 && item.status !== "analyzing" && (
          <div className="relative">
            <button
              onClick={() => setShowMove(!showMove)}
              className="font-mono text-[9px] px-1.5 py-0.5 rounded transition-colors"
              style={{ background: "var(--border-2)", color: "var(--text-3)" }}
              title="Move to another group"
            >
              ⇥
            </button>
            {showMove && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-lg overflow-hidden shadow-lg"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", minWidth: 140 }}
              >
                <p
                  className="font-mono text-[9px] uppercase tracking-wider px-3 py-1.5"
                  style={{ color: "var(--text-4)", borderBottom: "1px solid var(--border-2)" }}
                >
                  Move to
                </p>
                {otherGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      onMove(g.id);
                      setShowMove(false);
                    }}
                    className="w-full text-left px-3 py-2 font-mono text-[11px] transition-colors hover:opacity-70"
                    style={{ color: "var(--text-1)" }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!isRunning && (
          <button onClick={onRemove} className="text-[11px] transition-opacity hover:opacity-60" style={{ color: "var(--text-4)" }}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

