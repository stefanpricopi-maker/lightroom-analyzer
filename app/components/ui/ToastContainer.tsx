"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { removeToast, useToastStore, type Toast, type ToastType } from "@/app/lib/toast";

const EXIT_MS = 220;

function typeConfig(type: ToastType): { border: string; icon: string; iconColor: string } {
  if (type === "success") return { border: "#16a34a", icon: "✓", iconColor: "#16a34a" };
  if (type === "error") return { border: "#dc2626", icon: "✕", iconColor: "#dc2626" };
  if (type === "warning") return { border: "var(--accent)", icon: "⚠", iconColor: "var(--accent)" };
  return { border: "#7eb8c9", icon: "ℹ", iconColor: "#7eb8c9" };
}

function ToastCard({ t }: { t: Toast }) {
  const cfg = typeConfig(t.type);
  const duration = t.duration ?? 3000;

  const [exiting, setExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);

  const close = () => {
    if (exiting) return;
    setExiting(true);
    exitTimerRef.current = window.setTimeout(() => removeToast(t.id), EXIT_MS);
  };

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        background: "var(--surface)",
        border: `1px solid var(--border)`,
        borderLeft: `4px solid ${cfg.border}`,
        padding: "12px 16px",
        minHeight: 48,
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        animation: exiting ? `toast-out ${EXIT_MS}ms ease forwards` : `toast-in 240ms ease both`,
        willChange: "transform, opacity",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "color-mix(in srgb, " + cfg.border + " 12%, transparent)", color: cfg.iconColor }}
          aria-hidden="true"
        >
          <span className="text-[12px] font-bold">{cfg.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-mono text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
            {t.message}
          </p>
        </div>

        <button
          onClick={close}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70 flex-shrink-0"
          style={{ color: "var(--text-3)", background: "var(--surface-2)", border: "1px solid var(--border-2)" }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="absolute left-0 right-0 bottom-0 h-[2px]"
        style={{ background: "color-mix(in srgb, var(--border) 60%, transparent)" }}
      >
        <div
          className="h-full"
          style={{
            background: cfg.border,
            animation: `toast-progress ${duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToastStore();

  const ordered = useMemo(() => [...toasts], [toasts]);
  if (ordered.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "min(360px, calc(100vw - 32px))",
        pointerEvents: "none",
      }}
    >
      {ordered.map((t) => (
        <div key={t.id} style={{ pointerEvents: "auto" }}>
          <ToastCard t={t} />
        </div>
      ))}
    </div>
  );
}

