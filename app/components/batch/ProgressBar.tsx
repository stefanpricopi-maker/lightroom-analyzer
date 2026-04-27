"use client";

export function ProgressBar({ done, errors, total }: { done: number; errors: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round(((done + errors) / total) * 100);
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="font-mono text-[10px]" style={{ color: "var(--text-3)" }}>
          {done}/{total} complete
          {errors > 0 && <span style={{ color: "#dc2626" }}> · {errors} failed</span>}
        </span>
        <span className="font-mono text-[10px]" style={{ color: "var(--accent)" }}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "var(--accent)" }}
        />
      </div>
    </div>
  );
}

