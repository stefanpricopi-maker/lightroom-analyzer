"use client";

import { useEffect, useRef, useState } from "react";
import { useBatch } from "@/app/lib/batchContext";
import { useBatchQueue } from "@/app/lib/useBatchQueue";
import { exportGroupsZip } from "@/app/lib/batchExport";
import { BatchPreviewModal } from "@/app/components/ui/BatchPreviewModal";
import type { BatchItem, SceneGroup } from "@/app/lib/batchTypes";
import { SmartCluster } from "@/app/components/ui/SmartCluster";
import { ProgressBar } from "@/app/components/batch/ProgressBar";
import { SceneGroupCard } from "@/app/components/batch/SceneGroupCard";
import { toast } from "@/app/lib/toast";

// ─── Main BatchTab ────────────────────────────────────────────────────────────

export function BatchTab() {
  const { state, dispatch } = useBatch();
  const { startQueue, stopQueue, isRunning, stats } = useBatchQueue();
  const [exporting, setExporting] = useState(false);
  const [previewState, setPreviewState] = useState<{ item: BatchItem; group: SceneGroup } | null>(null);
  const wasRunningRef = useRef(false);
  const lastCompletionKeyRef = useRef<string | null>(null);

  const handleExportZip = async () => {
    setExporting(true);
    try {
      const summary = await exportGroupsZip(state.groups);
      toast.success(`ZIP downloaded — ${summary.exported} presets included`);
    } catch (err) {
      toast.error("Export failed. Please try again.");
    }
    setExporting(false);
  };

  const readyGroups = state.groups.filter((g) => g.heroStatus === "done" && g.heroResult);
  const totalWaiting = state.groups.filter((g) => g.heroResult).flatMap((g) => g.items.filter((i) => i.status === "waiting")).length;

  useEffect(() => {
    // When a run completes (running -> not running), emit completion toast once.
    if (isRunning) {
      wasRunningRef.current = true;
      return;
    }
    if (!wasRunningRef.current) return;

    const completed = stats.done + stats.errors;
    const total = stats.totalItems;
    const key = `${completed}/${total}/${stats.errors}`;
    if (total > 0 && completed === total && lastCompletionKeyRef.current !== key) {
      lastCompletionKeyRef.current = key;
      toast.success(`${stats.done} photos processed successfully`);
    }
    wasRunningRef.current = false;
  }, [isRunning, stats.done, stats.errors, stats.totalItems]);

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
              <button onClick={() => { stopQueue(); toast.info("Processing stopped"); }}
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
