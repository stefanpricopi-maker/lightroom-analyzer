"use client";

import { useState, useRef, useEffect } from "react";

interface SectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function Section({ title, icon, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(defaultOpen ? "auto" : 0);

  // When open state changes, animate to the measured content height
  useEffect(() => {
    if (!contentRef.current) return;

    if (open) {
      // Measure the natural height
      const measured = contentRef.current.scrollHeight;
      setHeight(measured);
      // After animation completes, switch to "auto" so it handles content changes
      const timer = setTimeout(() => setHeight("auto"), 250);
      return () => clearTimeout(timer);
    } else {
      // First snap to current pixel height so CSS transition has a from-value
      const measured = contentRef.current.scrollHeight;
      setHeight(measured);
      // Then on next frame animate to 0
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);

  return (
    <div className="border-b last:border-0" style={{ borderColor: "var(--border-2)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 py-3 bg-transparent border-none cursor-pointer text-left"
      >
        <span className="text-[12px]" style={{ color: "var(--text-4)" }}>{icon}</span>
        <span
          className="flex-1 font-syne font-semibold text-[11px] tracking-[0.12em] uppercase"
          style={{ color: "var(--text-3)" }}
        >
          {title}
        </span>
        <span
          className="text-[10px] inline-block"
          style={{
            color: "var(--text-4)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s ease",
          }}
        >
          ▾
        </span>
      </button>

      {/* Animated container */}
      <div
        style={{
          height: height === "auto" ? "auto" : `${height}px`,
          overflow: "hidden",
          transition: height === "auto" ? "none" : "height 0.25s ease",
        }}
      >
        <div ref={contentRef} className="pb-3">
          {children}
        </div>
      </div>
    </div>
  );
}
