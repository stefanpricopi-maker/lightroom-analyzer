"use client";

import { useState, useEffect } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("lr-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(saved ? saved === "dark" : prefersDark);

    const handler = (e: Event) => setDark((e as CustomEvent).detail === "dark");
    window.addEventListener("lr-theme-change", handler);
    return () => window.removeEventListener("lr-theme-change", handler);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("lr-theme", next ? "dark" : "light");
    window.dispatchEvent(new CustomEvent("lr-theme-change", { detail: next ? "dark" : "light" }));
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
      style={{
        background: "transparent",
        border: "1px solid var(--border)",
        color: "var(--text-3)",
        fontSize: "15px",
        lineHeight: 1,
      }}
    >
      {dark ? (
        // Sun — filled circle with rays using SVG
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>
          <line x1="12" y1="2" x2="12" y2="5"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="5" y2="12"/>
          <line x1="19" y1="12" x2="22" y2="12"/>
          <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/>
          <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
          <line x1="19.78" y1="4.22" x2="17.66" y2="6.34"/>
          <line x1="6.34" y1="17.66" x2="4.22" y2="19.78"/>
        </svg>
      ) : (
        // Moon — crescent using SVG
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}
