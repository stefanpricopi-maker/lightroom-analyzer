"use client";

import { useState, useCallback } from "react";
import { runCulling, type CullingReport, type CullingResult, type CullingOptions } from "@/app/lib/cullingEngine";
import type { BatchItem } from "@/app/lib/batchTypes";

// ─── Flag badge ───────────────────────────────────────────────────────────────

function FlagBadge({ flag }: { flag: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    blur:        { label: "⊘ Blur",        color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
    closed_eyes: { label: "◡ Eyes",        color: "#d97706", bg: "rgba(217,119,6,0.1)" },
    duplicate:   { label: "⎘ Duplicate",   color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
    ok:          { label: "✓ OK",           color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
  };
  const c = cfg[flag] ?? { label: flag, color: "var(--text-3)", bg: "var(--border-2)" };
  return (
    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider"
      style={{ color: c.color, background: c.bg }}>
      {c.label}
    </span>
  );
}

// ─── Item row with culling result ─────────────────────────────────────────────

function CulledItemRow({ item, result, onKeep, onReject }: {
  item: BatchItem;
  result: CullingResult;
  onKeep: () => void;
  onReject: () => void;
}) {
  const isProblematic = result.flags[0] !== "ok";

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl transition-all"
      style={{
        background: "var(--surface-2)",
        border: `1px solid ${isProblematic ? "rgba(220,38,38,0.2)" : "var(--border-2)"}`,
        opacity: result.flags.includes("duplicate") ? 0.7 : 1,
      }}>

      {/* Thumbnail */}
      <div className="relative flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.thumbnail} alt={item.file.name}
          className="w-12 h-12 object-cover rounded-lg"
          style={{ filter: result.flags.includes("blur") ? "blur(1px)" : "none" }} />
        {isProblematic && (
          <div className="absolute inset-0 rounded-lg border-2" style={{ borderColor: "#dc2626", opacity: 0.5 }} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[11px] truncate" style={{ color: "var(--text-1)" }}>
          {item.file.name}
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {result.flags.map((f) => <FlagBadge key={f} flag={f} />)}
        </div>
        {result.duplicateOf && (
          <p className="font-mono text-[9px] mt-0.5" style={{ color: "var(--text-4)" }}>
            Similar to earlier photo
          </p>
        )}
      </div>

      {/* Score hints */}
      <div className="text-right flex-shrink-0 space-y-0.5">
        <p className="font-mono text-[9px]" style={{ color: "var(--text-4)" }}>
          sharpness: {Math.round(result.blurScore)}
        </p>
        {result.eyeScore !== null && (
          <p className="font-mono text-[9px]" style={{ color: "var(--text-4)" }}>
            EAR: {result.eyeScore.toFixed(2)}
          </p>
        )}
      </div>

      {/* Keep / Reject */}
      <div className="flex gap-1.5 flex-shrink-0">
        <button onClick={onKeep}
          className="w-7 h-7 rounded-lg font-mono text-[12px] transition-colors flex items-center justify-center"
          style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}
          title="Keep">✓</button>
        <button onClick={onReject}
          className="w-7 h-7 rounded-lg font-mono text-[12px] transition-colors flex items-center justify-center"
          style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}
          title="Reject">✕</button>
      </div>
    </div>
  );
}

// ─── Settings panel ───────────────────────────────────────────────────────────

function CullingSettings({ options, onChange }: {
  options: CullingOptions;
  onChange: (o: CullingOptions) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      {[
        { key: "detectBlur",        label: "⊘ Blur",      desc: "Laplacian variance" },
        { key: "detectClosedEyes",  label: "◡ Eyes",       desc: "Face Mesh (TF.js)" },
        { key: "detectDuplicates",  label: "⎘ Duplicates", desc: "dHash" },
      ].map(({ key, label, desc }) => (
        <button key={key}
          onClick={() => onChange({ ...options, [key]: !options[key as keyof CullingOptions] })}
          className="p-2.5 rounded-xl border transition-all"
          style={{
            background: options[key as keyof CullingOptions] ? "color-mix(in srgb, var(--accent) 8%, var(--surface))" : "var(--surface-2)",
            borderColor: options[key as keyof CullingOptions] ? "var(--accent)" : "var(--border-2)",
          }}>
          <p className="font-syne font-semibold text-[12px]" style={{ color: options[key as keyof CullingOptions] ? "var(--accent)" : "var(--text-3)" }}>
            {label}
          </p>
          <p className="font-mono text-[9px] mt-0.5" style={{ color: "var(--text-4)" }}>{desc}</p>
        </button>
      ))}
    </div>
  );
}

// ─── Main CullingPanel ────────────────────────────────────────────────────────

interface CullingPanelProps {
  items: BatchItem[];
  onUpdateItems: (kept: BatchItem[]) => void;
}

export function CullingPanel({ items, onUpdateItems }: CullingPanelProps) {
  const [options, setOptions] = useState<CullingOptions>({
    detectBlur: true,
    detectClosedEyes: true,
    detectDuplicates: true,
  });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<CullingReport | null>(null);
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const run = useCallback(async () => {
    if (items.length === 0) return;
    setRunning(true);
    setProgress(0);
    setReport(null);
    setRejected(new Set());

    const result = await runCulling(
      items.map((i) => ({ id: i.id, thumbnail: i.thumbnail })),
      options,
      (done, total) => {
        setProgress(Math.round((done / total) * 100));
      }
    );

    setReport(result);
    setRunning(false);

    // Auto-suggest rejecting all flagged items
    const autoReject = new Set(
      result.results
        .filter((r) => r.flags[0] !== "ok")
        .map((r) => r.itemId)
    );
    setRejected(autoReject);
  }, [items, options]);

  const applySelection = () => {
    const kept = items.filter((i) => !rejected.has(i.id));
    onUpdateItems(kept);
    setReport(null);
    setRejected(new Set());
  };

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

      {/* Header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-2)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: "var(--accent)" }}>⬡</span>
          <p className="font-syne font-bold text-[15px]" style={{ color: "var(--text-1)" }}>AI Culling</p>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--border-2)", color: "var(--text-3)" }}>
            Local · 0 API cost
          </span>
        </div>
        <p className="font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
          Automatically flag blurry, closed-eye, and duplicate photos before batch processing.
        </p>
      </div>

      <div className="p-4 space-y-4">

        {/* Detection toggles */}
        {!report && !running && (
          <CullingSettings options={options} onChange={setOptions} />
        )}

        {/* Run button */}
        {!report && (
          <button onClick={run} disabled={running}
            className="w-full py-3 font-syne font-bold text-[12px] tracking-[0.08em] uppercase rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: "var(--accent)", color: "white" }}>
            {running ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {`Analyzing ${items.length} photos… ${progress}%`}
              </>
            ) : (
              <>⬡ Analyze {items.length} Photos</>
            )}
          </button>
        )}

        {/* Progress bar */}
        {running && (
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: "var(--accent)" }} />
          </div>
        )}

        {/* Report summary */}
        {report && (
          <>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "OK",         count: report.totalOk,         color: "#16a34a" },
                { label: "Blurry",     count: report.totalBlurry,     color: "#dc2626" },
                { label: "Eyes",       count: report.totalClosedEyes, color: "#d97706" },
                { label: "Dupes",      count: report.totalDuplicates, color: "#7c3aed" },
              ].map(({ label, count, color }) => (
                <div key={label} className="text-center p-2 rounded-xl"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border-2)" }}>
                  <p className="font-syne font-bold text-[18px]" style={{ color }}>{count}</p>
                  <p className="font-mono text-[9px] uppercase tracking-wider mt-0.5" style={{ color: "var(--text-4)" }}>{label}</p>
                </div>
              ))}
            </div>

            <p className="font-mono text-[10px]" style={{ color: "var(--text-4)" }}>
              Processed in {report.processingMs}ms · {rejected.size} flagged for rejection
            </p>

            {/* Item list */}
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1"
              style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}>
              {report.results.map((result) => {
                const item = items.find((i) => i.id === result.itemId);
                if (!item) return null;
                return (
                  <CulledItemRow key={result.itemId}
                    item={item} result={result}
                    onKeep={() => setRejected((prev) => { const s = new Set(prev); s.delete(item.id); return s; })}
                    onReject={() => setRejected((prev) => new Set([...prev, item.id]))}
                  />
                );
              })}
            </div>

            {/* Apply / Reset */}
            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "var(--border-2)" }}>
              <button onClick={() => { setReport(null); setRejected(new Set()); }}
                className="px-4 py-2.5 font-mono text-[11px] rounded-xl transition-colors"
                style={{ background: "var(--border-2)", color: "var(--text-3)" }}>
                ↺ Re-analyze
              </button>
              <button onClick={applySelection}
                className="flex-1 py-2.5 font-syne font-bold text-[12px] uppercase tracking-wider rounded-xl transition-colors"
                style={{ background: "var(--text-1)", color: "var(--bg)" }}>
                Keep {items.length - rejected.size} / Remove {rejected.size}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
