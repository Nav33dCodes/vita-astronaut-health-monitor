"use client";

import { useIsFetching } from "@tanstack/react-query";

/**
 * Thin indeterminate bar at the top of the viewport while a view loads data it doesn't have yet.
 * Background refreshes (data already on screen) don't count, so live updates never flash it.
 * The CSS animation fades it in after a short delay, so fast loads show nothing at all.
 */
export function LoadingBar() {
  const loading = useIsFetching({ predicate: (query) => query.state.data === undefined }) > 0;
  if (!loading) return null;

  return (
    <div role="progressbar" aria-label="Loading" className="fixed inset-x-0 top-0 z-50 h-0.5 animate-loading-in overflow-hidden">
      <div className="h-full w-1/3 animate-indeterminate rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
    </div>
  );
}
