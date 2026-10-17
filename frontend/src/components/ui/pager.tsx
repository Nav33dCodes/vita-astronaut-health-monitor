"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface PagerProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Enables the "Showing 11–20 of 42" summary (full variant). */
  totalItems?: number;
  pageSize?: number;
  itemLabel?: string;
  /** "full" for page footers, "compact" (‹ 2/5 ›) for card headers. */
  variant?: "full" | "compact";
  /** Next page is loading — previous rows stay visible meanwhile. */
  busy?: boolean;
  className?: string;
}

/** 1 … 4 5 6 … 12 — always shows first, last and the neighbours of the current page. */
function pageList(page: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? (["gap", p] as const) : ([p] as const)));
}

const NAV_BUTTON =
  "grid place-items-center rounded-lg border border-line bg-overlay/[0.03] text-muted transition hover:border-accent/40 hover:text-ink disabled:pointer-events-none disabled:opacity-35";

export function Pager({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  itemLabel = "items",
  variant = "full",
  busy,
  className,
}: PagerProps) {
  const go = (target: number) => onPageChange(Math.min(totalPages, Math.max(1, target)));

  if (variant === "compact") {
    if (totalPages <= 1) return null;
    return (
      <nav aria-label="Pagination" className={clsx("flex items-center gap-1 font-mono text-[10.5px] text-muted", className)}>
        {busy && <Loader2 className="size-3 animate-spin text-accent" aria-hidden />}
        <button className={clsx(NAV_BUTTON, "size-6")} onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="min-w-9 text-center tabular-nums" aria-live="polite">
          {page}/{totalPages}
        </span>
        <button className={clsx(NAV_BUTTON, "size-6")} onClick={() => go(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <ChevronRight className="size-3.5" />
        </button>
      </nav>
    );
  }

  const from = totalItems === undefined || !pageSize ? null : totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = totalItems === undefined || !pageSize ? null : Math.min(page * pageSize, totalItems);

  return (
    <nav
      aria-label="Pagination"
      className={clsx("flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-muted", className)}
    >
      <span className="flex items-center gap-2" aria-live="polite">
        {busy && <Loader2 className="size-3.5 animate-spin text-accent" aria-hidden />}
        {from !== null && to !== null
          ? totalItems === 0
            ? `No ${itemLabel}`
            : `Showing ${from}–${to} of ${totalItems} ${itemLabel}`
          : `Page ${page} of ${totalPages}`}
      </span>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button className={clsx(NAV_BUTTON, "h-8 px-2")} onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          {pageList(page, totalPages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-faint" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => go(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={clsx(
                  "h-8 min-w-8 rounded-lg px-2 tabular-nums transition",
                  p === page
                    ? "bg-accent/15 font-semibold text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]"
                    : "text-muted hover:bg-overlay/[0.05] hover:text-ink",
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            className={clsx(NAV_BUTTON, "h-8 px-2")}
            onClick={() => go(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </nav>
  );
}
