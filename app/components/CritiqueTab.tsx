"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ResultsSkeleton } from "@/app/components/ui/Skeleton";
import { Slider } from "@/app/components/ui/Slider";
import type { CritiqueIssue, CritiqueResult } from "@/app/lib/critiqueTypes";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const API_MAX_BYTES = 10 * 1024 * 1024; // compress to ~10MB

const SEVERITY = {
  critical: { icon: "🔴", color: "#dc2626" },
  warning: { icon: "🟡", color: "var(--accent)" },
  suggestion: { icon: "💡", color: "#16a34a" },
} as const;

function scoreColor(score: number) {
  if (score >= 8) return "#16a34a";
  if (score >= 5) return "var(--accent)";
  return "#dc2626";
}

function humanParamName(param: string) {
  const map: Record<string, string> = {
    Exposure2012: "Exposure",
    Contrast2012: "Contrast",
    Highlights2012: "Highlights",
    Shadows2012: "Shadows",
    Whites2012: "Whites",
    Blacks2012: "Blacks",
    Temperature: "White Balance Temp",
    Tint: "Tint",
    Vibrance: "Vibrance",
    Saturation: "Saturation",
    Sharpness: "Sharpening",
    LuminanceSmoothing: "Noise Reduction",
    ColorNoiseReduction: "Color Noise",
    VignetteAmount: "Vignette",
  };
  return map[param] ?? param;
}

function paramRange(param: string): { min: number; max: number; step?: number } {
  // Conservative ranges for read-only visualization.
  if (param === "Exposure2012") return { min: -5, max: 5, step: 0.01 };
  if (param === "Temperature") return { min: 2000, max: 12000, step: 1 };
  if (param === "Tint") return { min: -150, max: 150, step: 1 };
  if (param === "Sharpness") return { min: 0, max: 150, step: 1 };
  if (param === "LuminanceSmoothing") return { min: 0, max: 100, step: 1 };
  if (param === "ColorNoiseReduction") return { min: 0, max: 100, step: 1 };
  return { min: -100, max: 100, step: 1 };
}

async function compressToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const MAX_DIM = 2400;

      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);

      // Try multiple qualities until under ~10MB binary.
      const qualities = [0.85, 0.78, 0.7, 0.62, 0.55];
      for (const q of qualities) {
        const base64 = canvas.toDataURL("image/jpeg", q).split(",")[1] ?? "";
        if (!base64) continue;
        if (base64.length * 0.75 <= API_MAX_BYTES) {
          resolve({ base64, mime: "image/jpeg" });
          return;
        }
      }

      // Best-effort fallback
      const base64 = canvas.toDataURL("image/jpeg", 0.55).split(",")[1] ?? "";
      if (!base64) reject(new Error("Failed to encode image"));
      else resolve({ base64, mime: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read image"));
    };
    img.src = url;
  });
}

function buildPlainText(result: CritiqueResult): string {
  const lines: string[] = [];
  lines.push(`Overall score: ${result.overall_score}/10`);
  lines.push(`Summary: ${result.summary}`);
  lines.push("");

  lines.push("Priority fixes:");
  for (const [i, t] of (result.priority_fixes ?? []).slice(0, 3).entries()) {
    lines.push(`${i + 1}. ${t}`);
  }
  lines.push("");

  lines.push("Issues:");
  for (const issue of result.issues ?? []) {
    lines.push(`- [${issue.severity}] ${issue.category}: ${issue.title}`);
    lines.push(`  ${issue.description}`);
    if (issue.fix?.adjustments?.length) {
      lines.push(`  Fix in Lightroom (${issue.fix.panel}):`);
      for (const a of issue.fix.adjustments) {
        lines.push(`    - ${humanParamName(a.parameter)} = ${a.value} (${a.reason})`);
      }
    }
  }
  lines.push("");

  lines.push("Strengths:");
  for (const s of result.strengths ?? []) lines.push(`- ${s}`);
  return lines.join("\n");
}

function IssueCard({ issue }: { issue: CritiqueIssue }) {
  const sev = SEVERITY[issue.severity];
  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px]" aria-hidden="true">{sev.icon}</span>
            <p className="font-syne font-bold text-[14px] truncate" style={{ color: "var(--text-1)" }}>{issue.title}</p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border"
              style={{ color: "var(--text-3)", borderColor: "var(--border-2)", background: "var(--surface-2)" }}
            >
              {issue.category}
            </span>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border"
              style={{ color: sev.color, borderColor: "color-mix(in srgb, " + sev.color + " 30%, transparent)", background: "color-mix(in srgb, " + sev.color + " 10%, transparent)" }}
            >
              {issue.severity}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 font-mono text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
        {issue.description}
      </p>

      {issue.fix?.adjustments?.length ? (
        <details className="mt-4 rounded-2xl border" style={{ borderColor: "var(--border-2)", background: "var(--surface-2)" }}>
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
            <span className="font-syne font-bold text-[13px]" style={{ color: "var(--text-1)" }}>
              Fix in Lightroom
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--text-4)" }}>
              {issue.fix.panel}
            </span>
          </summary>
          <div className="px-4 pb-4">
            {issue.fix.adjustments.map((a, idx) => {
              const r = paramRange(a.parameter);
              return (
                <div key={idx} className="mt-3">
                  <div className="flex items-center justify-end gap-2 mb-1">
                    <div className="relative group">
                      <button
                        type="button"
                        className="font-mono text-[10px] transition-opacity hover:opacity-80 focus:outline-none"
                        style={{ color: "var(--text-4)" }}
                        aria-label="Show reason"
                      >
                        ⓘ Reason
                      </button>
                      <div
                        className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity absolute right-0 top-full mt-2 w-[260px] rounded-xl border p-2.5 z-20"
                        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                      >
                        <p className="font-mono text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                          {a.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Slider
                    label={humanParamName(a.parameter)}
                    value={a.value}
                    min={r.min}
                    max={r.max}
                    step={r.step}
                  />
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function CritiqueTab() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CritiqueResult | null>(null);

  const canAnalyze = !!imageBase64 && !!mimeType && !loading;

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.`);
      return;
    }

    setError(null);
    setResult(null);

    const url = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });

    const { base64, mime } = await compressToBase64(file);
    setImageBase64(base64);
    setMimeType(mime);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const analyze = useCallback(async () => {
    if (!imageBase64 || !mimeType) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      if (!res.ok) {
        if (res.status === 413) throw new Error("Image too large for the critique endpoint.");
        throw new Error("API error");
      }
      const data: CritiqueResult = await res.json();
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to analyze photo. Please try again.";
      setError(msg);
    }
    setLoading(false);
  }, [imageBase64, mimeType]);

  const copyText = useMemo(() => (result ? buildPlainText(result) : ""), [result]);
  const onCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      setError("Failed to copy to clipboard.");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* LEFT */}
      <div className="space-y-4">
        <div
          className="relative rounded-2xl overflow-hidden aspect-[4/3] flex flex-col items-center justify-center cursor-pointer transition-all"
          style={{
            outline: dragging ? "2px solid var(--accent)" : previewUrl ? "1px solid var(--border)" : "1px dashed var(--border)",
            background: dragging ? "color-mix(in srgb, var(--accent) 5%, var(--surface))" : previewUrl ? "transparent" : "var(--surface)",
          }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {previewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all flex items-center justify-center group">
                <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-white opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-3 py-1.5 rounded-full">
                  Change photo
                </span>
              </div>
            </>
          ) : (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: "var(--border-2)" }}>
                <span className="text-xl" style={{ color: "var(--text-3)" }}>↑</span>
              </div>
              <div>
                <p className="font-mono text-[12px]" style={{ color: "var(--text-3)" }}>
                  Drop photo or <span style={{ color: "var(--accent)" }} className="underline underline-offset-2">browse</span>
                </p>
                <p className="font-mono text-[10px] mt-1" style={{ color: "var(--text-4)" }}>
                  Upload a photo to get feedback
                </p>
              </div>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />

        <button
          disabled={!canAnalyze}
          onClick={analyze}
          className="w-full py-4 font-syne font-bold text-[13px] tracking-[0.08em] uppercase rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          style={{ background: "var(--text-1)", color: "var(--bg)" }}
        >
          {loading ? (
            <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />Analyzing…</>
          ) : (
            <><span className="text-[16px]">◎</span>Analyze Photo</>
          )}
        </button>

        {error && (
          <div
            className="p-3 rounded-lg text-[12px] font-mono"
            style={{ background: "rgba(220,50,50,0.08)", border: "1px solid rgba(220,50,50,0.25)", color: "#e05050" }}
          >
            {error}
          </div>
        )}
      </div>

      {/* RIGHT */}
      {loading ? (
        <ResultsSkeleton />
      ) : !result ? (
        <div className="rounded-2xl border flex flex-col items-center justify-center h-[400px] text-center gap-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "var(--bg)" }}>
            <span className="text-3xl" style={{ color: "var(--border)" }}>✶</span>
          </div>
          <div>
            <p className="font-syne font-semibold text-[14px]" style={{ color: "var(--text-3)" }}>No critique yet</p>
            <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text-4)" }}>Upload a photo to get feedback</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-y-auto" style={{ background: "var(--surface)", borderColor: "var(--border)", maxHeight: "85vh" }}>
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "var(--border-2)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center font-mono font-bold text-[12px]"
                  style={{
                    border: `2px solid ${scoreColor(result.overall_score)}`,
                    color: scoreColor(result.overall_score),
                    background: "var(--surface-2)",
                  }}
                >
                  {result.overall_score}/10
                </div>
                <div className="min-w-0">
                  <p className="font-syne font-bold text-[15px]" style={{ color: "var(--text-1)" }}>Photo Critique</p>
                  <p className="font-mono text-[12px] italic mt-1" style={{ color: "var(--text-2)" }}>
                    “{result.summary}”
                  </p>
                </div>
              </div>
              <button
                onClick={onCopy}
                className="px-3 py-2 rounded-lg font-mono text-[11px] transition-opacity hover:opacity-80 border"
                style={{ background: "var(--surface)", borderColor: "var(--border-2)", color: "var(--text-2)" }}
              >
                Copy All Fixes as Text
              </button>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Priority fixes */}
            <div className="rounded-2xl border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-2)" }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--text-3)" }}>
                Priority fixes
              </p>
              <ol className="mt-3 space-y-1 list-decimal list-inside font-mono text-[12px]" style={{ color: "var(--text-1)" }}>
                {(result.priority_fixes ?? []).slice(0, 3).map((t, idx) => (
                  <li key={idx} style={{ color: "var(--text-2)" }}>{t}</li>
                ))}
              </ol>
            </div>

            {/* Issues */}
            <div className="space-y-3">
              {(result.issues ?? []).map((issue, idx) => (
                <IssueCard key={idx} issue={issue} />
              ))}
            </div>

            {/* Strengths */}
            <div className="rounded-2xl border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-2)" }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--text-3)" }}>
                Strengths
              </p>
              <ul className="mt-3 space-y-1 font-mono text-[12px]" style={{ color: "var(--text-2)" }}>
                {(result.strengths ?? []).map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span style={{ color: "#16a34a" }}>✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

