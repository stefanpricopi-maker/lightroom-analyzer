"use client";

import { useState, useEffect } from "react";
import { recommendHero } from "@/app/lib/imageRanking";
import type { BatchItem } from "@/app/lib/batchTypes";

interface HeroRecommendationProps {
  items: BatchItem[];
  onAccept: (item: BatchItem) => void;
}

export function HeroRecommendationBadge({ items, onAccept }: HeroRecommendationProps) {
  const [loading, setLoading] = useState(false);
  const [recommendedId, setRecommendedId] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Reset when items change
    setRecommendedId(null);
    setDismissed(false);
  }, [items.length]);

  const runAnalysis = async () => {
    if (items.length < 2) return;
    setLoading(true);
    try {
      const result = await recommendHero(items);
      if (result) {
        setRecommendedId(result.recommendedId);
        setReason(result.reason);
      }
    } finally {
      setLoading(false);
    }
  };

  const recommendedItem = items.find((i) => i.id === recommendedId);

  if (dismissed || items.length < 2) return null;

  return (
    <div className="rounded-xl p-3 space-y-2"
      style={{ background: "color-mix(in srgb, var(--accent) 6%, var(--surface))", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)" }}>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--accent)" }}>◈</span>
          <p className="font-syne font-semibold text-[12px]" style={{ color: "var(--text-1)" }}>
            Hero Recommendation
          </p>
        </div>
        <button onClick={() => setDismissed(true)}
          className="font-mono text-[10px] transition-opacity hover:opacity-60"
          style={{ color: "var(--text-4)" }}>✕</button>
      </div>

      {!recommendedId && !loading && (
        <>
          <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            Analyze photos locally to find the best hero shot — closest to the group's median exposure and color, with the cleanest EXIF settings.
          </p>
          <button onClick={runAnalysis}
            className="w-full py-2 font-mono text-[11px] rounded-lg transition-all"
            style={{ background: "var(--accent)", color: "white" }}>
            ◈ Analyze & Recommend
          </button>
        </>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-1">
          <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <p className="font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
            Analyzing {items.length} photos locally…
          </p>
        </div>
      )}

      {recommendedItem && !loading && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-2 rounded-lg"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recommendedItem.thumbnail} alt="Recommended"
              className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-mono text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                  style={{ background: "var(--accent)", color: "white" }}>★ Recommended</span>
              </div>
              <p className="font-mono text-[11px] truncate" style={{ color: "var(--text-1)" }}>
                {recommendedItem.file.name}
              </p>
              <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>
                {reason}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                onAccept(recommendedItem);
                setDismissed(true);
              }}
              className="flex-1 py-2 font-mono text-[11px] rounded-lg transition-all"
              style={{ background: "var(--text-1)", color: "var(--bg)" }}>
              ✓ Use as Hero Shot
            </button>
            <button
              onClick={() => { setRecommendedId(null); setReason(""); }}
              className="px-3 py-2 font-mono text-[11px] rounded-lg transition-all"
              style={{ background: "var(--border-2)", color: "var(--text-3)" }}>
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline badge shown on the recommended thumbnail in the item list ─────────

export function RecommendedBadge() {
  return (
    <span
      className="absolute top-1 left-1 font-mono text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider z-10"
      style={{ background: "var(--accent)", color: "white" }}
    >
      ★ Hero
    </span>
  );
}
