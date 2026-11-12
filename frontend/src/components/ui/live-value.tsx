"use client";

import clsx from "clsx";
import { useState, type ReactNode } from "react";

/**
 * Wraps a live number and briefly highlights it when, and only when, the value changes.
 * Uses the "adjust state during render" pattern, so no effect and no extra paint.
 */
export function LiveValue({ value, children, className }: { value: unknown; children: ReactNode; className?: string }) {
  const [previous, setPrevious] = useState(value);
  const [changes, setChanges] = useState(0);
  if (previous !== value) {
    setPrevious(value);
    setChanges(changes + 1);
  }

  return (
    <span key={changes} className={clsx("tnum -mx-1 rounded px-1", changes > 0 && "animate-flash", className)}>
      {children}
    </span>
  );
}
