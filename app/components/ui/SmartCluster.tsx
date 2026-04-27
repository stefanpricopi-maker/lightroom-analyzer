
"use client";

import { useState } from "react";
import { useBatch } from "@/app/lib/batchContext";
import { readItemDates, clusterByTime } from "@/app/lib/autoCluster";
import type { BatchItem } from "@/app/lib/batchTypes";

interface SmartClusterProps {
  allItems: BatchItem[];
}

export function SmartCluster({ allItems }: SmartClusterProps) {
  const { dispatch } = useBatch();
  const [threshold, setThreshold] = useState(20); // minutes
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ name: string; count: number }[] | null>(null);
  const [applied, setApplied] = useState(false);

  const runCluster = async (apply: boolean) => {
    if (allItems.length === 0) return;
    setLoading(true);
    setApplied(false);

    try {
      const withDates = await readItemDates(allItems);
      const clusters = clusterByTime(withDates, threshold);

      if (!apply) {
        // Just preview
        setPreview(clusters.map((c) => ({ name: c.name, count: c.items.length })));
      } else {
        // Apply — replace existing groups with clustered ones
        // First clear all existing groups (keep one)
        // Then create a group per cluster
        setPreview(null);
        setApplied(true);

        // Dispatch: replace all groups with new clustered groups
        dispatch({ type: "APPLY_CLUSTERS", clusters });
      }
    } finally {
      setLoading(false);
    }
  };

  if (allItems.length === 0) return null;

  return (
    <div className="rounded-2xl border p-4 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: "var(--accent)" }}>⏱</span>
          <p className="font-syne font-bold text-[14px]" style={{ color: "var(--text-1)" }}>Smart Cluster</p>
        </div>
        <p className="font-mono text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          Automatically group photos by shooting time. Photos taken within the gap threshold will be placed in the same scene group.
        </p>
      </div>

      {/* Threshold slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[11px]" style={{ color: "var(--text-2)" }}>Time gap threshold</p>
          <span className="font-syne font-bold text-[13px]" style={{ color: "var(--accent)" }}>{threshold} min</span>
        </div>
        <input
          type="range" min={5} max={120} step={5} value={threshold}
          onChange={(e) => { setThreshold(parseInt(e.target.value)); setPreview(null); setApplied(false); }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: "var(--accent)", background: `linear-gradient(to right, var(--accent) ${((threshold - 5) / 115) * 100}%, var(--border) ${((threshold - 5) / 115) * 100}%)` }}
        />
        <div className="flex justify-between mt-1">
          <span className="font-mono text-[9px]" style={{ color: "var(--text-4)" }}>5 min</span>
          <span className="font-mono text-[9px]" style={{ color: "var(--text-4)" }}>fine</span>
          <span className="font-mono text-[9px]" style={{ color: "var(--text-4)" }}>coarse</span>
          <span className="font-mono text-[9px]" style={{ color: "var(--text-4)" }}>2h</span>
        </div>
      </div>

      {/* Preview result */}
      {preview && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border-2)" }}>
          <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--text-4)" }}>
            Preview — {preview.length} group{preview.length !== 1 ? "s" : ""}
          </p>
          {preview.map((g, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="font-mono text-[11px]" style={{ color: "var(--text-2)" }}>{g.name}</span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--border-2)", color: "var(--text-3)" }}>
                {g.count} photo{g.count !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {applied && (
        <div className="font-mono text-[11px] px-3 py-2 rounded-lg" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)", color: "#16a34a" }}>
          ✓ Groups created — add a hero shot to each group to start processing.
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          disabled={loading}
          onClick={() => runCluster(false)}
          className="flex-1 py-2 font-mono text-[11px] rounded-lg transition-all disabled:opacity-40"
          style={{ background: "var(--border-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}
        >
          {loading && !applied ? "Reading…" : "Preview Groups"}
        </button>
        <button
          disabled={loading}
          onClick={() => runCluster(true)}
          className="flex-1 py-2 font-mono text-[11px] rounded-lg transition-all disabled:opacity-40"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {loading && applied ? "Clustering…" : "✦ Apply Clustering"}
        </button>
      </div>
    </div>
  );
}
