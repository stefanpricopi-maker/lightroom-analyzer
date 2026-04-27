"use client";

import { useRef, useCallback, useEffect } from "react";

interface SliderProps {
  label: string;
  value: number;
  originalValue?: number;
  min: number;
  max: number;
  unit?: string;
  step?: number;
  onChange?: (value: number) => void;
}

export function Slider({ label, value, originalValue, min, max, unit = "", step = 1, onChange }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;
  const zeroInRange = min <= 0 && max >= 0;
  const midPercent = zeroInRange ? ((0 - min) / (max - min)) * 100 : 0;
  const isNegative = zeroInRange ? value < 0 : false;
  const fillLeft = zeroInRange ? (isNegative ? percent : midPercent) : 0;
  const fillWidth = zeroInRange ? Math.abs(percent - midPercent) : Math.max(0, percent);
  const THUMB_RADIUS_PX = 6; // matches 12px thumb
  const clampLeft = (p: number) =>
    `clamp(${THUMB_RADIUS_PX}px, ${p}%, calc(100% - ${THUMB_RADIUS_PX}px))`;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const isModified = originalValue !== undefined && value !== originalValue && !!onChange;

  const valueFromClientX = useCallback((clientX: number) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    const stepped = Math.round(raw / step) * step;
    const precision = step < 1 ? Math.round(-Math.log10(step)) : 0;
    return parseFloat(Math.max(min, Math.min(max, stepped)).toFixed(precision));
  }, [min, max, step, value]);

  useEffect(() => {
    if (!onChange) return;
    const onMouseMove = (e: MouseEvent) => { if (dragging.current) onChange(valueFromClientX(e.clientX)); };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onChange, valueFromClientX]);

  return (
    <div className="grid items-center gap-3 mb-2" style={{ gridTemplateColumns: "90px 1fr 56px" }}>
      <span className="text-[11px] capitalize truncate" style={{ color: "var(--text-3)" }}>{label}</span>

      <div
        ref={trackRef}
        className={`relative h-[14px] flex items-center ${onChange ? "cursor-ew-resize" : ""}`}
        onMouseDown={(e) => { if (!onChange) return; e.preventDefault(); dragging.current = true; onChange(valueFromClientX(e.clientX)); }}
        onClick={(e) => { if (onChange) onChange(valueFromClientX(e.clientX)); }}
      >
        <div className="absolute inset-x-0 h-[3px] rounded-full" style={{ background: "var(--border)" }}>
          {isModified && originalValue !== undefined && (
            <div
              className="absolute w-[2px] h-[6px] rounded-full top-1/2"
              style={{ left: clampLeft(((originalValue - min) / (max - min)) * 100), transform: "translateX(-50%) translateY(-50%)", background: "var(--accent)", opacity: 0.4 }}
            />
          )}
          <div
            className="absolute h-full rounded-full"
            style={{ left: `${fillLeft}%`, width: `${fillWidth}%`, background: isNegative ? "var(--accent)" : "var(--text-1)" }}
          />
        </div>
        <div
          className={`absolute w-[12px] h-[12px] rounded-full top-1/2 -translate-x-1/2 -translate-y-1/2 ${onChange ? "hover:scale-110" : ""}`}
          style={{
            left: clampLeft(percent),
            background: isModified ? "var(--accent)" : "var(--surface)",
            border: `2px solid ${isModified ? "var(--accent)" : "var(--text-1)"}`,
            transition: "transform 0.1s",
          }}
        />
      </div>

      <div className="flex items-center justify-end gap-1">
        {isModified && (
          <button onClick={() => onChange?.(originalValue!)} title="Reset to AI value" className="text-[9px] transition-opacity hover:opacity-70" style={{ color: "var(--accent)" }}>↺</button>
        )}
        <span className="text-[11px] font-mono text-right" style={{ color: isModified ? "var(--accent)" : isNegative ? "var(--accent)" : value > 0 ? "var(--text-1)" : "var(--text-4)" }}>
          {zeroInRange && value > 0 ? `+${value}` : value}{unit}
        </span>
      </div>
    </div>
  );
}
