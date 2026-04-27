"use client";

import type { BatchItem } from "@/app/lib/batchTypes";

export function StatusBadge({ status }: { status: BatchItem["status"] }) {
  const cfg = {
    waiting: { label: "Waiting", color: "var(--text-4)", bg: "var(--border-2)" },
    analyzing: { label: "Analyzing", color: "#c07040", bg: "rgba(192,112,64,0.1)" },
    done: { label: "Done", color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
    error: { label: "Error", color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
  }[status];

  return (
    <span
      className="font-mono text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full flex items-center gap-1"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {status === "analyzing" && (
        <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />
      )}
      {cfg.label}
    </span>
  );
}

