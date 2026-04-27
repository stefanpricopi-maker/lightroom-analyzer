"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Shared hook for Before/After slider drag interaction.
 * Attaches mousemove + mouseup to window so the handle never
 * loses focus even when the mouse moves fast outside the container.
 */
export function useBeforeAfter(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [position, setPosition] = useState(50);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  }, [containerRef]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragging.current) updatePosition(e.clientX);
    };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [updatePosition]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    updatePosition(e.clientX);
  }, [updatePosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    updatePosition(e.touches[0].clientX);
  }, [updatePosition]);

  return { position, startDrag, handleTouchMove };
}