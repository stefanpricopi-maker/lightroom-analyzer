"use client";

import type { LightroomResult } from "@/app/lib/types";
import { ResultsSkeleton } from "@/app/components/ui/Skeleton";
import {
  LightPanel,
  ColorPanel,
  HSLPanel_Wrapped,
  ColorGradingPanel,
  DetailPanel,
  EffectsPanel,
  CalibrationPanel,
} from "@/app/components/panels/Panels";

export function ResultsPanel({
  result,
  editedResult,
  onUpdate,
  onResetAll,
  loading,
  presetName,
  setPresetName,
  savedMsg,
  onSave,
  onDownload,
  image,
  selectedCollection,
  setSelectedCollection,
  collectionNames,
}: {
  result: LightroomResult | null;
  editedResult: LightroomResult | null;
  onUpdate: (path: string[], value: number) => void;
  onResetAll: () => void;
  loading: boolean;
  presetName: string;
  setPresetName: (v: string) => void;
  savedMsg: boolean;
  onSave: () => void;
  onDownload: () => void;
  image: string | null;
  selectedCollection: string;
  setSelectedCollection: (v: string) => void;
  collectionNames: string[];
}) {
  if (loading) return <ResultsSkeleton />;

  if (!result)
    return (
      <div
        className="rounded-2xl border flex flex-col items-center justify-center h-[400px] text-center gap-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "var(--bg)" }}>
          <span className="text-3xl" style={{ color: "var(--border)" }}>
            ◈
          </span>
        </div>
        <div>
          <p className="font-syne font-semibold text-[14px]" style={{ color: "var(--text-3)" }}>
            No analysis yet
          </p>
          <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text-4)" }}>
            Upload a photo and hit Analyze
          </p>
        </div>
      </div>
    );

  return (
    <div
      className="rounded-2xl border overflow-y-auto"
      style={{ background: "var(--surface)", borderColor: "var(--border)", maxHeight: "85vh" }}
    >
      {/* Sticky header — stays visible while scrolling panels */}
      <div
        className="px-5 pt-5 pb-4 border-b"
        style={{
          borderColor: "var(--border-2)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--surface)",
        }}
      >
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] font-mono text-[10px] tracking-[0.1em] uppercase text-[#16a34a] mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
          {result.confidence} confidence
        </div>
        {result.style_summary && (
          <p className="font-mono text-[12px] leading-relaxed italic" style={{ color: "var(--text-2)" }}>
            "{result.style_summary}"
          </p>
        )}
      </div>

      <div className="px-5 py-4 border-b" style={{ background: "var(--surface-2)", borderColor: "var(--border-2)" }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] mb-3" style={{ color: "var(--text-3)" }}>
          Save & Export
        </p>
        <textarea
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="Preset name..."
          rows={2}
          className="w-full border rounded-lg px-3 py-2 font-mono text-[12px] outline-none transition-colors mb-2 resize-none leading-relaxed"
          style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-1)" }}
        />
        <select
          value={selectedCollection}
          onChange={(e) => setSelectedCollection(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 font-mono text-[12px] outline-none transition-colors mb-2 cursor-pointer"
          style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-2)" }}
        >
          {collectionNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={onSave}
            className="flex-1 px-3 py-2.5 border font-mono text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1.5"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-2)" }}
          >
            {savedMsg ? "✓ Saved!" : "◫  Save to Library"}
          </button>
          <button
            onClick={onDownload}
            className="flex-1 px-3 py-2.5 font-mono text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1.5"
            style={{ background: "var(--text-1)", color: "var(--bg)" }}
          >
            ↓ Download .xmp
          </button>
        </div>

        <p className="font-mono text-[10px] mt-2" style={{ color: "var(--text-4)" }}>
          Lightroom → Develop → Presets → right-click → Import Presets
        </p>
      </div>

      {/* Reset all bar */}
      {editedResult && result && JSON.stringify(editedResult) !== JSON.stringify(result) && (
        <div
          className="px-5 py-3 border-b flex items-center justify-between gap-3"
          style={{ background: "var(--surface-2)", borderColor: "var(--border-2)" }}
        >
          <p className="font-mono text-[11px] text-[#c07040] flex items-center gap-1.5">
            <span>✦</span>
            <span>You have unsaved slider changes</span>
          </p>
          <button
            onClick={onResetAll}
            className="flex-shrink-0 px-3 py-1.5 font-mono text-[11px] rounded-lg transition-colors"
            style={{ background: "var(--surface)", border: "1px solid var(--accent)", color: "var(--accent)" }}
          >
            ↺ Reset to AI values
          </button>
        </div>
      )}
      <div className="px-5 py-2">
        <LightPanel data={editedResult?.light ?? result.light} original={result.light} onUpdate={onUpdate} />
        <ColorPanel data={editedResult?.color ?? result.color} original={result.color} onUpdate={onUpdate} />
        <HSLPanel_Wrapped data={editedResult?.hsl ?? result.hsl} original={result.hsl} onUpdate={onUpdate} />
        <ColorGradingPanel data={editedResult?.color_grading ?? result.color_grading} original={result.color_grading} onUpdate={onUpdate} />
        <DetailPanel data={editedResult?.detail ?? result.detail} original={result.detail} onUpdate={onUpdate} />
        <EffectsPanel data={editedResult?.effects ?? result.effects} original={result.effects} onUpdate={onUpdate} />
        <CalibrationPanel data={editedResult?.calibration ?? result.calibration} original={result.calibration} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

