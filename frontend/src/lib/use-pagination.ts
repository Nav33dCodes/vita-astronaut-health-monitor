"use client";

import { useMemo, useState } from "react";

/**
 * Client-side pagination over an in-memory list. The page is clamped rather than reset with an
 * effect, so a shrinking list (e.g. alerts being resolved) never leaves you on an empty page.
 */
export function usePagination<T>(items: readonly T[], pageSize: number) {
  const [requestedPage, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);

  return { page, setPage, totalPages, pageItems, totalItems: items.length, pageSize };
}
