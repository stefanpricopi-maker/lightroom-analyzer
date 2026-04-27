"use client";

import { useState, useEffect } from "react";
import { ToastContainer } from "@/app/components/ui/ToastContainer";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("lr-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    setMounted(true);

    const handler = (e: Event) => {
      const isDark = (e as CustomEvent).detail === "dark";
      setDark(isDark);
      // Also set on body background directly for full coverage
      document.body.style.background = isDark ? "#0e0e0e" : "#f5f4f2";
    };
    window.addEventListener("lr-theme-change", handler);
    return () => window.removeEventListener("lr-theme-change", handler);
  }, []);

  // Before mount, render with no theme class to avoid SSR mismatch
  if (!mounted) {
    return (
      <div className="theme-root" style={{ minHeight: "100vh" }}>
        {children}
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className={`theme-root${dark ? " dark" : ""}`} style={{ minHeight: "100vh" }}>
      {children}
      <ToastContainer />
    </div>
  );
}
