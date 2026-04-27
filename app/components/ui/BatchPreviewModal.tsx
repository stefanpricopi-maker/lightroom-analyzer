"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { LightroomResult } from "@/app/lib/types";
import { buildFilterString } from "@/app/lib/imageUtils";

interface BatchPreviewModalProps {
  thumbnail: string;
  filename: string;
  heroResult: LightroomResult;
  onClose: () => void;
}

function BeforeAfterSlider({ image, filterString }: { image: string; filterString: string }) {
  const [position, setPosition] = useState(50);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => { if (dragging.current) updatePosition(e.clientX); };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [updatePosition]);

  const imgStyle: React.CSSProperties = {
    position: "absolute", inset: 0, width: "100%", height: "100%",
    objectFit: "cover", objectPosition: "center", display: "block",
  };

  return (
    <div ref={containerRef}
      className="relative overflow-hidden rounded-xl select-none"
      style={{ aspectRatio: "3/2", cursor: "col-resize" }}>
      {/* After — hero color applied */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="After" style={{ ...imgStyle, filter: filterString }} draggable={false} />
      {/* Before — original */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="Before" style={{ ...imgStyle, clipPath: `inset(0 ${100 - position}% 0 0)` }} draggable={false} />
      {/* Labels */}
      <div className="absolute bottom-2 left-3 font-mono text-[10px] uppercase tracking-widest text-white/70 bg-black/40 px-2 py-0.5 rounded pointer-events-none">Before</div>
      <div className="absolute bottom-2 right-3 font-mono text-[10px] uppercase tracking-widest text-white/70 bg-black/40 px-2 py-0.5 rounded pointer-events-none">After</div>
      {/* Divider */}
      <div className="absolute top-0 bottom-0 w-[2px] bg-white/80 pointer-events-none"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }} />
      {/* Handle */}
      <div className="absolute top-1/2 z-10 w-8 h-8 rounded-full shadow-lg flex items-center justify-center cursor-col-resize"
        style={{ left: `${position}%`, transform: "translate(-50%, -50%)", background: "var(--surface)", border: "1px solid var(--border)" }}
        onMouseDown={(e) => { e.preventDefault(); dragging.current = true; }}>
        <span className="text-[11px] font-bold select-none" style={{ color: "var(--text-3)" }}>⇄</span>
      </div>
    </div>
  );
}

export function BatchPreviewModal({ thumbnail, filename, heroResult, onClose }: BatchPreviewModalProps) {
  const filterString = buildFilterString(heroResult);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border-2)" }}>
          <div>
            <p className="font-syne font-bold text-[14px]" style={{ color: "var(--text-1)" }}>Color Style Preview</p>
            <p className="font-mono text-[10px] mt-0.5 truncate max-w-[280px]" style={{ color: "var(--text-3)" }}>{filename}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--text-3)", background: "var(--border-2)" }}>✕</button>
        </div>

        {/* Slider */}
        <div className="p-4">
          <BeforeAfterSlider image={thumbnail} filterString={filterString} />
        </div>

        {/* Disclaimer */}
        <div className="px-5 pb-4">
          <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 6%, var(--surface))", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)" }}>
            <span style={{ color: "var(--accent)" }} className="text-[13px] flex-shrink-0 mt-0.5">⚠</span>
            <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              This preview shows <strong>color style only</strong> (HSL, Color Grading, Saturation) from the hero shot. Individual exposure adjustments (Exposure, Contrast, Highlights, Shadows) will be calculated by AI per photo during batch processing and are <strong>not reflected here</strong>.
            </p>
          </div>
        </div>

        {/* Hero style summary */}
        {heroResult.style_summary && (
          <div className="px-5 pb-4">
            <p className="font-mono text-[11px] italic leading-relaxed" style={{ color: "var(--text-3)" }}>
              "{heroResult.style_summary}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
