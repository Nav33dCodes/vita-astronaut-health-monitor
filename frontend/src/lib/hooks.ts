"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * False during SSR and hydration, true afterwards. Use it to defer UI that depends on
 * client-only state (e.g. cached query data) inside late-hydrating Suspense boundaries.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./api/client";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Copies server-side validation errors (camelCase keys) onto form fields.
 * Returns a general message for anything that isn't a field error.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): string | null {
  if (!(error instanceof ApiError)) return "Unexpected error. Please try again.";

  const entries = Object.entries(error.fieldErrors);
  for (const [field, messages] of entries) {
    setError(field as Path<T>, { type: "server", message: messages[0] });
  }
  return entries.length > 0 ? null : error.message;
}
