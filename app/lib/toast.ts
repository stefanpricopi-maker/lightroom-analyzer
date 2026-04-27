"use client";

import { useSyncExternalStore } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms, default 3000
}

type ToastInternal = Toast & { createdAt: number };

const DEFAULT_DURATION = 3000;
const MAX_TOASTS = 4;

let toasts: ToastInternal[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, number>();

function emit() {
  for (const l of listeners) l();
}

function getSnapshot() {
  return toasts as Toast[];
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function scheduleRemoval(id: string, durationMs: number) {
  const prev = timers.get(id);
  if (prev) window.clearTimeout(prev);
  const t = window.setTimeout(() => removeToast(id), durationMs);
  timers.set(id, t);
}

export function addToast(input: Omit<Toast, "id"> & { id?: string }): string {
  const id = input.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const duration = input.duration ?? DEFAULT_DURATION;
  const createdAt = Date.now();

  // Deduplicate by id if reused.
  toasts = toasts.filter((t) => t.id !== id);
  toasts = [...toasts, { ...input, id, duration, createdAt }];

  if (toasts.length > MAX_TOASTS) {
    const overflow = toasts.length - MAX_TOASTS;
    const removed = toasts.slice(0, overflow);
    toasts = toasts.slice(overflow);
    for (const t of removed) removeToast(t.id);
  }

  emit();
  scheduleRemoval(id, duration);
  return id;
}

export function removeToast(id: string) {
  const prev = timers.get(id);
  if (prev) {
    window.clearTimeout(prev);
    timers.delete(id);
  }
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function useToastStore(): {
  toasts: Toast[];
  addToast: typeof addToast;
  removeToast: typeof removeToast;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { toasts: snapshot, addToast, removeToast };
}

export const toast = {
  success(message: string, opts?: { duration?: number }) {
    return addToast({ type: "success", message, duration: opts?.duration });
  },
  error(message: string, opts?: { duration?: number }) {
    return addToast({ type: "error", message, duration: opts?.duration });
  },
  info(message: string, opts?: { duration?: number }) {
    return addToast({ type: "info", message, duration: opts?.duration });
  },
  warning(message: string, opts?: { duration?: number }) {
    return addToast({ type: "warning", message, duration: opts?.duration });
  },
};

