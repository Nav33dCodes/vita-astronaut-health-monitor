import clsx from "clsx";
import type { ReactNode } from "react";

/*
 * Skeleton kit. Every shape mirrors the component it stands in for (same heights, paddings and
 * radii), so content replaces it without the layout moving. No hooks: safe in loading.tsx.
 */

/** A single shimmering block. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("skeleton", className)} />;
}

/** Wraps a loading region: announces it once and fades in only if loading takes >150ms. */
export function SkeletonGroup({ children, className, label = "Loading" }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={clsx("skeleton-reveal", className)}>
      {children}
    </div>
  );
}

/** Lines of text; the last line is shorter, like real paragraphs. */
export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={clsx("h-3", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  );
}

/** Card frame with a title row; body is whatever skeleton the card holds. */
export function SkeletonCard({ children, className, title = true }: { children?: ReactNode; className?: string; title?: boolean }) {
  return (
    <div className={clsx("glass rounded-[var(--radius-card)] p-5", className)}>
      {title && (
        <div className="mb-5 space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      )}
      {children}
    </div>
  );
}

/** KPI card: label, big number, footer line. */
export function SkeletonKpi() {
  return (
    <div className="glass flex h-full min-h-[132px] flex-col gap-3 rounded-[var(--radius-card)] p-4 sm:p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="mt-auto h-3 w-32" />
    </div>
  );
}

/** Table body: a header band plus rows with an optional avatar column. */
export function SkeletonTable({ rows = 6, columns = 6, avatar = true }: { rows?: number; columns?: number; avatar?: boolean }) {
  return (
    <div>
      <div className="flex h-9 items-center gap-6 border-y border-line bg-canvas px-5">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className={clsx("h-2.5", i === 0 ? "w-24" : "w-12", i > 0 && "ml-auto")} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex h-[57px] items-center gap-6 border-b border-line px-5 last:border-b-0 compact:h-[45px]">
          <div className="flex w-48 shrink-0 items-center gap-3">
            {avatar && <Skeleton className="size-8 shrink-0 !rounded-full" />}
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
          {Array.from({ length: columns - 1 }, (_, c) => (
            <Skeleton key={c} className={clsx("ml-auto h-3", c === 0 ? "w-16" : "w-10")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Rows of a list (alerts, feeds): icon, two lines, trailing actions. */
export function SkeletonList({ rows = 5, actions = true, checkbox = false }: { rows?: number; actions?: boolean; checkbox?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-start gap-3 py-3">
          {checkbox && <Skeleton className="mt-0.5 size-4 shrink-0" />}
          <Skeleton className="mt-0.5 size-4 shrink-0 !rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={clsx("h-3.5", i % 2 ? "w-2/3" : "w-1/2")} />
            <Skeleton className="h-3 w-1/3" />
          </div>
          {actions && (
            <div className="hidden shrink-0 gap-2 sm:flex">
              <Skeleton className="h-8 w-24 !rounded-lg" />
              <Skeleton className="h-8 w-16 !rounded-lg" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Chart area with faint gridlines, so the box reads as "a chart is coming". */
export function SkeletonChart({ height = 240, className }: { height?: number; className?: string }) {
  return (
    <div className={clsx("relative", className)} style={{ height }}>
      <div className="absolute inset-0 flex flex-col justify-between py-2" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-px bg-line" />
        ))}
      </div>
      <Skeleton className="absolute inset-x-0 bottom-0 h-2/3 !rounded-md opacity-60" />
    </div>
  );
}

/** A grid of identical tiles (monitor tiles, cabin metrics, mission cards). */
export function SkeletonTiles({ count, className, tile }: { count: number; className?: string; tile: ReactNode }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{tile}</div>
      ))}
    </div>
  );
}
