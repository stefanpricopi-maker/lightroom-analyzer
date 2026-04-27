"use client";

// Base shimmer animation skeleton block
export function SkeletonBlock({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded ${className}`}
      style={{
        background: "linear-gradient(90deg, var(--border-2) 25%, var(--border) 50%, var(--border-2) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
        ...style,
      }}
    />
  );
}

// A skeleton row mimicking a slider
function SkeletonSlider() {
  return (
    <div className="grid items-center gap-3 mb-2" style={{ gridTemplateColumns: "90px 1fr 56px" }}>
      <SkeletonBlock style={{ height: 10, width: "70%" }} />
      <SkeletonBlock style={{ height: 3, borderRadius: 9999 }} />
      <SkeletonBlock style={{ height: 10, width: "60%", marginLeft: "auto" }} />
    </div>
  );
}

// A skeleton section mimicking a collapsible panel
function SkeletonSection({ sliders = 4 }: { sliders?: number }) {
  return (
    <div className="border-b py-3" style={{ borderColor: "var(--border-2)" }}>
      <div className="flex items-center gap-2.5 mb-4">
        <SkeletonBlock style={{ width: 14, height: 14, borderRadius: "50%" }} />
        <SkeletonBlock style={{ width: 80, height: 10 }} />
      </div>
      {Array.from({ length: sliders }).map((_, i) => (
        <SkeletonSlider key={i} />
      ))}
    </div>
  );
}

// Full results panel skeleton
export function ResultsSkeleton() {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "var(--border-2)" }}>
        <SkeletonBlock style={{ width: 100, height: 22, borderRadius: 999, marginBottom: 14 }} />
        <SkeletonBlock style={{ width: "90%", height: 10, marginBottom: 8 }} />
        <SkeletonBlock style={{ width: "70%", height: 10 }} />
      </div>

      {/* Save & Export */}
      <div className="px-5 py-4 border-b" style={{ background: "var(--surface-2)", borderColor: "var(--border-2)" }}>
        <SkeletonBlock style={{ width: 80, height: 9, marginBottom: 14 }} />
        <SkeletonBlock style={{ height: 38, borderRadius: 8, marginBottom: 8 }} />
        <SkeletonBlock style={{ height: 38, borderRadius: 8, marginBottom: 8 }} />
        <div className="flex gap-2">
          <SkeletonBlock style={{ flex: 1, height: 38, borderRadius: 8 }} />
          <SkeletonBlock style={{ flex: 1, height: 38, borderRadius: 8 }} />
        </div>
      </div>

      {/* Panels */}
      <div className="px-5 py-2">
        <SkeletonSection sliders={6} />
        <SkeletonSection sliders={4} />
        <SkeletonSection sliders={3} />
        <SkeletonSection sliders={3} />
      </div>
    </div>
  );
}
