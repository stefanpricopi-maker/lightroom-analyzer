"use client";

import { useRef } from "react";
import type { LightroomResult } from "@/app/lib/types";
import { useBeforeAfter } from "@/app/lib/useBeforeAfter";

interface BeforeAfterProps {
  image: string;
  result: LightroomResult;
}

function buildFilterString(result: LightroomResult): string {
  const { light, color } = result;
  const brightness = 1 + light.exposure * 0.15;
  const contrast = 1 + light.contrast * 0.008;
  const saturation = 1 + color.saturation * 0.01 + color.vibrance * 0.005;
  const tempShift = (color.temperature - 5500) / 5500;
  const hueRotate = tempShift * -15 + color.tint * 0.1;
  const highlightAdj = 1 + light.highlights * 0.002;
  const shadowAdj = 1 + light.shadows * 0.002;
  const combinedBrightness = brightness * highlightAdj * shadowAdj;
  return [
    `brightness(${combinedBrightness.toFixed(3)})`,
    `contrast(${contrast.toFixed(3)})`,
    `saturate(${Math.max(0, saturation).toFixed(3)})`,
    `hue-rotate(${hueRotate.toFixed(1)}deg)`,
  ].join(" ");
}

export function BeforeAfter({ image, result }: BeforeAfterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { position, startDrag, handleTouchMove } = useBeforeAfter(containerRef);
  const filterString = buildFilterString(result);

  const imgStyle: React.CSSProperties = {
    position: "absolute", inset: 0, width: "100%", height: "100%",
    objectFit: "cover", objectPosition: "center", display: "block",
  };

  return (
    <div className="mt-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] mb-3"
        style={{ color: "var(--text-3)" }}>
        Before / After Preview
      </p>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl select-none"
        style={{ aspectRatio: "3/2", cursor: "col-resize" }}
      >
        {/* AFTER — filtered */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="After" style={{ ...imgStyle, filter: filterString }} draggable={false} />

        {/* BEFORE — clipped via clip-path */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="Before" style={{ ...imgStyle, clipPath: `inset(0 ${100 - position}% 0 0)` }} draggable={false} />

        {/* Labels */}
        <div className="absolute bottom-2 left-3 font-mono text-[10px] uppercase tracking-widest text-white/70 bg-black/40 px-2 py-0.5 rounded z-10 pointer-events-none">Before</div>
        <div className="absolute bottom-2 right-3 font-mono text-[10px] uppercase tracking-widest text-white/70 bg-black/40 px-2 py-0.5 rounded z-10 pointer-events-none">After</div>

        {/* Divider */}
        <div className="absolute top-0 bottom-0 w-[2px] bg-white/90 pointer-events-none z-20"
          style={{ left: `${position}%`, transform: "translateX(-50%)" }} />

        {/* Handle */}
        <div
          className="absolute top-1/2 z-30 w-8 h-8 rounded-full shadow-md flex items-center justify-center cursor-col-resize"
          style={{ left: `${position}%`, transform: "translate(-50%, -50%)", background: "var(--surface)", border: "1px solid var(--border)" }}
          onMouseDown={startDrag}
          onTouchStart={() => {}}
          onTouchMove={handleTouchMove}
        >
          <span className="text-[11px] font-bold select-none" style={{ color: "var(--text-3)" }}>⇄</span>
        </div>
      </div>

      <p className="font-mono text-[10px] mt-2 text-center" style={{ color: "var(--text-4)" }}>
        Drag the handle to compare &middot; After preview uses CSS approximation
      </p>
    </div>
  );
}
