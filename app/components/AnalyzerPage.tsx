"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { LightroomResult } from "@/app/lib/types";
import { downloadXMP } from "@/app/lib/xmp";
import { savePreset, saveCollection, loadCollections, loadPresets, getAllCollectionNames, generateThumbnail, DEFAULT_COLLECTION_NAME, type SavedPreset } from "@/app/lib/presetStorage";
import { BeforeAfter } from "@/app/components/ui/BeforeAfter";
import { ExifBadge } from "@/app/components/ui/ExifBadge";
import { ResultsSkeleton } from "@/app/components/ui/Skeleton";
import { extractExif, readFileAsBuffer, type ExifData } from "@/app/lib/exif";
import { PresetLibrary } from "@/app/components/ui/PresetLibrary";
import { ThemeToggle } from "@/app/components/ui/ThemeToggle";
import { BatchTab } from "@/app/components/BatchTab";
import { BatchProvider } from "@/app/lib/batchContext";
import {
  LightPanel, ColorPanel, HSLPanel_Wrapped,
  ColorGradingPanel, DetailPanel, EffectsPanel, CalibrationPanel,
  setIn,
} from "@/app/components/panels/Panels";

type Tab = "analyze" | "diff" | "batch";

// ─── Shared results panel ────────────────────────────────────────────────────
function ResultsPanel({
  result, editedResult, onUpdate, onResetAll, loading, presetName, setPresetName, savedMsg, onSave, onDownload, image, imageBase64,
  selectedCollection, setSelectedCollection, collectionNames,
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
  imageBase64: string | null;
  selectedCollection: string;
  setSelectedCollection: (v: string) => void;
  collectionNames: string[];
}) {
  if (loading) return <ResultsSkeleton />;

  if (!result) return (
    <div className="rounded-2xl border flex flex-col items-center justify-center h-[400px] text-center gap-4" style={{background:"var(--surface)",borderColor:"var(--border)"}}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{background:"var(--bg)"}}>
        <span className="text-3xl" style={{color:"var(--border)"}}>◈</span>
      </div>
      <div>
        <p className="font-syne font-semibold text-[14px]" style={{color:"var(--text-3)"}}>No analysis yet</p>
        <p className="font-mono text-[11px] mt-1" style={{color:"var(--text-4)"}}>Upload a photo and hit Analyze</p>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border overflow-y-auto" style={{background:"var(--surface)",borderColor:"var(--border)",maxHeight:"85vh"}}>
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
          <p className="font-mono text-[12px] leading-relaxed italic" style={{color:"var(--text-2)"}}>
            "{result.style_summary}"
          </p>
        )}
      </div>

      <div className="px-5 py-4 border-b" style={{background:"var(--surface-2)",borderColor:"var(--border-2)"}}>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] mb-3" style={{color:"var(--text-3)"}}>Save & Export</p>
        <textarea
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="Preset name..."
          rows={2}
          className="w-full border rounded-lg px-3 py-2 font-mono text-[12px] outline-none transition-colors mb-2 resize-none leading-relaxed" style={{background:"var(--input-bg)",borderColor:"var(--border)",color:"var(--text-1)"}}
        />
        <select
          value={selectedCollection}
          onChange={(e) => setSelectedCollection(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 font-mono text-[12px] outline-none transition-colors mb-2 cursor-pointer" style={{background:"var(--input-bg)",borderColor:"var(--border)",color:"var(--text-2)"}}
        >
          {collectionNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button onClick={onSave} className="flex-1 px-3 py-2.5 border font-mono text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1.5" style={{background:"var(--surface)",borderColor:"var(--border)",color:"var(--text-2)"}}>
            {savedMsg ? "✓ Saved!" : "◫  Save to Library"}
          </button>
          <button onClick={onDownload} className="flex-1 px-3 py-2.5 font-mono text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1.5" style={{background:"var(--text-1)",color:"var(--bg)"}}>
            ↓ Download .xmp
          </button>
        </div>

        <p className="font-mono text-[10px] mt-2" style={{color:"var(--text-4)"}}>
          Lightroom → Develop → Presets → right-click → Import Presets
        </p>
      </div>

      {/* Reset all bar */}
      {editedResult && result && JSON.stringify(editedResult) !== JSON.stringify(result) && (
        <div className="px-5 py-3 border-b flex items-center justify-between gap-3" style={{background:"var(--surface-2)",borderColor:"var(--border-2)"}}>
          <p className="font-mono text-[11px] text-[#c07040] flex items-center gap-1.5">
            <span>✦</span>
            <span>You have unsaved slider changes</span>
          </p>
          <button
            onClick={onResetAll}
            className="flex-shrink-0 px-3 py-1.5 font-mono text-[11px] rounded-lg transition-colors" style={{background:"var(--surface)",border:"1px solid var(--accent)",color:"var(--accent)"}}
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

// ─── Upload slot (reusable) ──────────────────────────────────────────────────
function UploadSlot({
  label, image, onFile,
}: {
  label: string;
  image: string | null;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) onFile(file);
  }, [onFile]);

  return (
    <div className="flex-1 min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] mb-2" style={{color:"var(--text-3)"}}>{label}</p>
      <div
        className={`relative rounded-xl overflow-hidden aspect-[4/3] flex flex-col items-center justify-center cursor-pointer transition-all ${
          dragging ? "ring-2 ring-[#c07040] bg-[#fdf8f5]"
          : image ? "ring-1 ring-[#e8e5e0]"
          : ""
        }`}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={label} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all flex items-center justify-center group">
              <span className="font-mono text-[10px] tracking-widest uppercase text-white opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-3 py-1.5 rounded-full">
                Change
              </span>
            </div>
          </>
        ) : (
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto" style={{background:"var(--border-2)"}}>
              <span className="text-lg" style={{color:"var(--text-3)"}}>↑</span>
            </div>
            <p className="font-mono text-[11px]" style={{color:"var(--text-3)"}}>Drop or <span style={{color:"var(--accent)"}} className="underline underline-offset-2">browse</span></p>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function AnalyzerPage() {
  const [tab, setTab] = useState<Tab>("analyze");

  // Analyze tab state
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<LightroomResult | null>(null);
  const [editedResult, setEditedResult] = useState<LightroomResult | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [loadedFromLibrary, setLoadedFromLibrary] = useState(false);
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Diff tab state
  const [origImage, setOrigImage] = useState<string | null>(null);
  const [origBase64, setOrigBase64] = useState<string | null>(null);
  const [origMime, setOrigMime] = useState<string | null>(null);
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editBase64, setEditBase64] = useState<string | null>(null);
  const [editMime, setEditMime] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<LightroomResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  // Shared preset state
  const [presetName, setPresetName] = useState("My Preset");
  const [savedMsg, setSavedMsg] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(DEFAULT_COLLECTION_NAME);

  const activeResult = tab === "analyze" ? analyzeResult : diffResult;
  const activeEditedResult = editedResult ?? activeResult;
  const activeImage = tab === "analyze" ? image : editImage;

  // ── File loading helpers ──
  const loadFile = (file: File, setImg: (v: string) => void, setB64: (v: string) => void, setMime: (v: string) => void) => {
    setImg(URL.createObjectURL(file));
    setMime(file.type);
    const reader = new FileReader();
    reader.onload = (e) => setB64((e.target?.result as string).split(",")[1]);
    reader.readAsDataURL(file);
  };

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB — allow large files, we compress before API
  const API_MAX_SIZE = 10 * 1024 * 1024;   // 10MB — compress down to this for the API

  // Compress image to target size using canvas
  const compressImage = (file: File): Promise<{ base64: string; mime: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        // Scale down if needed — target max 2400px on longest side
        const MAX_DIM = 2400;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
          else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        // Try quality 0.85 first, drop to 0.7 if still too big
        let base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
        if (base64.length * 0.75 > API_MAX_SIZE) {
          base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
        }
        resolve({ base64, mime: "image/jpeg" });
      };
      img.src = url;
    });
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setAnalyzeError("Please upload a valid image file (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setAnalyzeError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.`);
      return;
    }
    setAnalyzeResult(null);
    setAnalyzeError(null);
    setLoadedFromLibrary(false);
    setExifData(null);
    // Show preview from original file
    setImage(URL.createObjectURL(file));
    // Extract EXIF from original file before any compression
    readFileAsBuffer(file).then((buf) => setExifData(extractExif(buf))).catch(() => {});
    // Compress for API if needed
    if (file.size > API_MAX_SIZE) {
      compressImage(file).then(({ base64, mime }) => {
        setImageBase64(base64);
        setImageMime(mime);
      });
    } else {
      setImageMime(file.type);
      const reader = new FileReader();
      reader.onload = (e) => setImageBase64((e.target?.result as string).split(",")[1]);
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }, []);

  // ── Analyze ──
  const analyze = async () => {
    if (!imageBase64 || !imageMime) return;
    setAnalyzeLoading(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: imageMime }),
      });
      if (!res.ok) throw new Error();
      const data: LightroomResult = await res.json();
      setAnalyzeResult(data);
      // Use full style summary as preset name
      setPresetName(data.style_summary || "My Preset");
    } catch {
      setAnalyzeError("Failed to analyze image. Please try again.");
    }
    setAnalyzeLoading(false);
  };

  // ── Diff ──
  const diff = async () => {
    if (!origBase64 || !editBase64) return;
    setDiffLoading(true);
    setDiffError(null);
    try {
      const res = await fetch("/api/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalBase64: origBase64, originalMime: origMime, editedBase64: editBase64, editedMime: editMime }),
      });
      if (!res.ok) throw new Error();
      const data: LightroomResult = await res.json();
      setDiffResult(data);
      setEditedResult(data);
      setPresetName(data.style_summary || "Edit Difference");
    } catch {
      setDiffError("Failed to compare images. Please try again.");
    }
    setDiffLoading(false);
  };

  // ── Slider updates ──
  const handleUpdate = useCallback((path: string[], value: number) => {
    setEditedResult((prev) => {
      const base = prev ?? (tab === "analyze" ? analyzeResult : diffResult);
      if (!base) return prev;
      return setIn(base as object, path, value) as LightroomResult;
    });
  }, [tab, analyzeResult, diffResult]);

  const handleResetAll = useCallback(() => {
    const base = tab === "analyze" ? analyzeResult : diffResult;
    setEditedResult(base);
  }, [tab, analyzeResult, diffResult]);

  // ── Save / Export ──
  const handleSave = async () => {
    if (!activeResult || !activeImage) return;
    const thumbnail = await generateThumbnail(activeImage);
    savePreset({ id: `preset-${Date.now()}`, name: presetName || "My Preset", collection: selectedCollection, thumbnail, result: activeEditedResult ?? activeResult!, savedAt: Date.now() });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    setAnalyzeResult(preset.result);
    setEditedResult(preset.result);
    setPresetName(preset.name);
    setImage(null);
    setImageBase64(null);
    setImageMime(null);
    setLoadedFromLibrary(true);
    setExifData(null);
    setTab("analyze");
  };

  const [collectionNames, setCollectionNames] = useState<string[]>(() =>
    getAllCollectionNames(loadPresets(), loadCollections())
  );

  // Refresh collection names whenever the library drawer might have changed
  const refreshCollections = useCallback(() => {
    setCollectionNames(getAllCollectionNames(loadPresets(), loadCollections()));
  }, []);

  useEffect(() => {
    // Refresh on focus (user returns from library drawer)
    window.addEventListener("focus", refreshCollections);
    // Also poll every second to catch changes from the drawer
    const interval = setInterval(refreshCollections, 1000);
    return () => {
      window.removeEventListener("focus", refreshCollections);
      clearInterval(interval);
    };
  }, [refreshCollections]);

  return (
    <div className="min-h-screen" style={{background:"var(--bg)"}}>
      {/* Nav */}
      <nav className="border-b sticky top-0 z-40 backdrop-blur-sm" style={{borderColor:"var(--border)",background:"var(--nav-bg)"}}>
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{background:"var(--text-1)"}}>
              <span className="text-white text-[10px]">◈</span>
            </div>
            <span className="font-syne font-bold text-[14px] tracking-tight" style={{color:"var(--text-1)"}}>LR Analyzer</span>
          </div>
          <div className="flex items-center gap-2"><ThemeToggle /><PresetLibrary onLoad={handleLoadPreset} onClose={refreshCollections} /></div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-[1200px] mx-auto px-6 pt-14 pb-8" style={{color:"var(--text-1)"}}>
        <h1 className="font-syne font-extrabold text-[clamp(28px,3.2vw,46px)] leading-[1.02] tracking-tight whitespace-nowrap" style={{color:"var(--text-1)"}}>
          Decode any photo <span className="italic text-[#c07040]">edit.</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed font-mono" style={{color:"var(--text-3)"}}>
          Upload an edited photo. Get every Lightroom setting used to create the look — ready to apply.
        </p>
      </div>

      {/* Tabs */}
      <div className="max-w-[1200px] mx-auto px-6 mb-6">
        <div className="inline-flex border rounded-xl p-1 gap-1" style={{background:"var(--surface)",borderColor:"var(--border)"}}>
          {([
            { id: "analyze", label: "◎  Analyze Photo" },
            { id: "diff",    label: "⇄  Edit Difference" },
            { id: "batch",   label: "⊞  Batch Event Mode" },
          ] as { id: Tab; label: string }[]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="px-4 py-2 rounded-lg font-mono text-[12px] tracking-wide transition-all"
            style={{
              background: tab === id ? "var(--text-1)" : "transparent",
              color: tab === id ? "var(--bg)" : "var(--text-3)",
            }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-6 pb-20">
        {tab === "batch" ? (
          <BatchProvider><BatchTab /></BatchProvider>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* LEFT */}
          <div className="space-y-4">

            {/* ── ANALYZE TAB ── */}
            {tab === "analyze" && (
              <>
                <div
                  className="relative rounded-2xl overflow-hidden aspect-[4/3] flex flex-col items-center justify-center cursor-pointer transition-all"
                  style={{
                    outline: dragging ? "2px solid var(--accent)" : image ? "1px solid var(--border)" : loadedFromLibrary ? "1px dashed var(--accent)" : "1px dashed var(--border)",
                    background: dragging || loadedFromLibrary ? "color-mix(in srgb, var(--accent) 5%, var(--surface))" : image ? "transparent" : "var(--surface)",
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  {image ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all flex items-center justify-center group">
                        <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-white opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-3 py-1.5 rounded-full">
                          Change photo
                        </span>
                      </div>
                    </>
                  ) : loadedFromLibrary ? (
                    <div className="text-center space-y-3 px-6">
                      <div className="w-12 h-12 rounded-full bg-[#f0ede8] flex items-center justify-center mx-auto">
                        <span className="text-[#c07040] text-xl">◫</span>
                      </div>
                      <div>
                        <p className="font-mono text-[12px]" style={{color:"var(--text-2)"}}>Preset loaded from library</p>
                        <p className="font-mono text-[10px] mt-1" style={{color:"var(--text-4)"}}>Click to upload a photo for Before/After</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{background:"var(--border-2)"}}>
                        <span className="text-xl" style={{color:"var(--text-3)"}}>↑</span>
                      </div>
                      <div>
                        <p className="font-mono text-[12px]" style={{color:"var(--text-3)"}}>Drop photo or <span style={{color:"var(--accent)"}} className="underline underline-offset-2">browse</span></p>
                        <p className="font-mono text-[10px] mt-1" style={{color:"var(--text-4)"}}>JPG, PNG, WEBP</p>
                      </div>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
                <button
                  disabled={!image || analyzeLoading || !imageBase64}
                  onClick={analyze}
                  className="w-full py-4 font-syne font-bold text-[13px] tracking-[0.08em] uppercase rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3" style={{background:"var(--text-1)",color:"var(--bg)"}}
                >
                  {analyzeLoading ? (
                    <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />Analyzing edit style…</>
                  ) : (
                    <><span className="text-[16px]">◎</span>Analyze Edit Style</>
                  )}
                </button>
                {analyzeError && <div className="p-3 rounded-lg text-[12px] font-mono" style={{background:"rgba(220,50,50,0.08)",border:"1px solid rgba(220,50,50,0.25)",color:"#e05050"}}>{analyzeError}</div>}
                {analyzeResult && image && imageBase64 && <BeforeAfter image={image} result={editedResult ?? analyzeResult} />}
              </>
            )}

            {/* ── DIFF TAB ── */}
            {tab === "diff" && (
              <>
                <div className="rounded-2xl border p-4" style={{background:"var(--surface)",borderColor:"var(--border)"}}>
                  <p className="font-mono text-[11px] mb-4 leading-relaxed" style={{color:"var(--text-3)"}}>
                    Upload the <span className="text-[#1a1a1a] font-medium">original</span> and <span className="text-[#1a1a1a] font-medium">edited</span> versions of the same photo. The AI will detect exactly what changed between them.
                  </p>
                  <div className="flex gap-3">
                    <UploadSlot
                      label="Original (unedited)"
                      image={origImage}
                      onFile={(f) => {
                      if (f.size > 50 * 1024 * 1024) { setDiffError(`Image is too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.`); return; }
                      loadFile(f, setOrigImage, setOrigBase64, setOrigMime);
                    }}
                    />
                    <div className="flex items-center justify-center flex-shrink-0 mt-6">
                      <span className="text-xl font-mono" style={{color:"var(--text-4)"}}>⇄</span>
                    </div>
                    <UploadSlot
                      label="Edited version"
                      image={editImage}
                      onFile={(f) => {
                      if (f.size > 50 * 1024 * 1024) { setDiffError(`Image is too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.`); return; }
                      loadFile(f, setEditImage, setEditBase64, setEditMime);
                    }}
                    />
                  </div>
                </div>

                <button
                  disabled={!origBase64 || !editBase64 || diffLoading}
                  onClick={diff}
                  className="w-full py-4 font-syne font-bold text-[13px] tracking-[0.08em] uppercase rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3" style={{background:"var(--text-1)",color:"var(--bg)"}}
                >
                  {diffLoading ? (
                    <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />Comparing images…</>
                  ) : (
                    <><span className="text-[16px]">⇄</span>Detect Edit Difference</>
                  )}
                </button>
                {diffError && <div className="p-3 rounded-lg text-[12px] font-mono" style={{background:"rgba(220,50,50,0.08)",border:"1px solid rgba(220,50,50,0.25)",color:"#e05050"}}>{diffError}</div>}
              </>
            )}
          </div>

          {/* RIGHT — Results */}
          <ResultsPanel
            result={activeResult}
            editedResult={activeEditedResult}
            onUpdate={handleUpdate}
            onResetAll={handleResetAll}
            loading={tab === "analyze" ? analyzeLoading : diffLoading}
            presetName={presetName}
            setPresetName={setPresetName}
            savedMsg={savedMsg}
            onSave={handleSave}
            onDownload={() => (activeEditedResult ?? activeResult) && downloadXMP(activeEditedResult ?? activeResult!, presetName || "My Preset")}
            image={activeImage}
            imageBase64={tab === "analyze" ? imageBase64 : editBase64}
            selectedCollection={selectedCollection}
            setSelectedCollection={setSelectedCollection}
            collectionNames={collectionNames}
          />
        </div>
        )}
      </div>
    </div>
  );
}
