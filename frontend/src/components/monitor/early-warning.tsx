"use client";

import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Timer } from "lucide-react";
import Link from "next/link";
import { Pager } from "@/components/ui/pager";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { EwsBadge, RISK_LABEL, RISK_TEXT } from "@/components/ui/ews";
import { useAssessment, useEarlyWarningScoring, useFleetAssessments } from "@/lib/api/queries";
import type { Trend } from "@/lib/api/types";
import { METRIC_LABELS } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";

/** Compact trend chip: arrow, metric, rate and (if any) time until the safe limit is crossed. */
export function TrendChip({ trend }: { trend: Trend }) {
  const Arrow = trend.direction === "Rising" ? ArrowUpRight : ArrowDownRight;
  const watch = trend.severity === "Watch";
  return (
    <span
      title={trend.message}
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap",
        watch ? "border-caution/40 bg-caution/10 text-caution" : "border-line-strong bg-overlay/[0.03] text-muted",
      )}
    >
      <Arrow className="size-3" aria-hidden />
      {METRIC_LABELS[trend.metric]} {trend.changePerHour > 0 ? "+" : ""}
      {trend.changePerHour}/h
      {trend.minutesToLimit !== null && (
        <>
          <Timer className="ml-0.5 size-3" aria-hidden />~{trend.minutesToLimit}m
        </>
      )}
    </span>
  );
}

/** Fleet-wide early-warning ranking, most at-risk first, paged to fit a fixed-height card. */
export function EarlyWarningBoard({ pageSize = 5 }: { pageSize?: number }) {
  const fleet = useFleetAssessments();
  const { page, setPage, totalPages, pageItems } = usePagination(fleet.data ?? [], pageSize);

  if (fleet.isPending) return <Skeleton className="h-56" />;
  if (fleet.isError) return <ErrorState error={fleet.error} onRetry={() => fleet.refetch()} />;
  if (fleet.data.length === 0) return <EmptyState title="No telemetry to assess yet" />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
    <ul className="divide-y divide-line">
      {pageItems.map((a) => (
        <li key={a.astronautId}>
          <Link href={`/crew/${a.astronautId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 transition hover:opacity-80">
            <span className={clsx("w-8 text-right font-mono text-2xl font-semibold", a.risk ? RISK_TEXT[a.risk] : "text-muted")}>
              {a.score ?? "—"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{a.astronautName}</span>
              <span className={clsx("block font-mono text-[10px]", a.risk ? RISK_TEXT[a.risk] : "text-muted")}>
                {a.risk ? `${RISK_LABEL[a.risk]} risk` : "No score"}
              </span>
            </span>
            <span className="flex flex-wrap justify-end gap-1">
              {a.trends.length === 0 ? (
                <span className="font-mono text-[10px] text-faint">stable</span>
              ) : (
                a.trends.slice(0, 2).map((t) => <TrendChip key={t.metric} trend={t} />)
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
    <Pager variant="compact" page={page} totalPages={totalPages} onPageChange={setPage} className="mt-auto self-end pt-2" />
    </div>
  );
}

const POINT_STYLE = ["bg-nominal/50", "bg-caution/60", "bg-caution", "bg-critical"];

/** Detailed early-warning breakdown for one astronaut. */
export function AssessmentPanel({ astronautId }: { astronautId: string }) {
  const assessment = useAssessment(astronautId);
  const scoring = useEarlyWarningScoring();

  if (assessment.isPending) return <Skeleton className="h-72" />;
  if (assessment.isError) return <ErrorState error={assessment.error} onRetry={() => assessment.refetch()} />;

  const a = assessment.data;
  if (a.score === null || a.risk === null) return <EmptyState title="No readings to score yet" />;

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-4">
        <p className={clsx("font-mono text-6xl leading-none font-semibold", RISK_TEXT[a.risk])}>{a.score}</p>
        <div className="pb-1">
          <p className="font-mono text-xs text-muted">/ {scoring.data?.maxScore ?? "–"} early warning score</p>
          <EwsBadge score={a.score} risk={a.risk} showLabel />
        </div>
      </div>

      <dl className="space-y-1.5">
        {a.components.map((c) => (
          <div key={c.metric} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-xs">
            <dt className="text-muted">{METRIC_LABELS[c.metric]}</dt>
            <dd className="font-mono text-ink">{c.value}</dd>
            <dd className="flex gap-0.5" aria-label={`${c.points} points`}>
              {[1, 2, 3].map((i) => (
                <span key={i} className={clsx("h-2 w-4 rounded-sm", i <= c.points ? POINT_STYLE[c.points] : "bg-overlay/[0.07]")} />
              ))}
            </dd>
          </div>
        ))}
      </dl>

      <div>
        <p className="hud-label mb-2 !text-[9px]">Trends · last {a.windowMinutes} min</p>
        {a.trends.length === 0 ? (
          <p className="rounded-xl border border-line bg-overlay/[0.02] px-3 py-2 text-xs text-muted">
            All vitals stable — no sustained drift detected.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {a.trends.map((t) => (
              <li
                key={t.metric}
                className={clsx(
                  "rounded-xl border px-3 py-2 text-xs",
                  t.severity === "Watch" ? "border-caution/40 bg-caution/10 text-ink" : "border-line bg-overlay/[0.02] text-muted",
                )}
              >
                {t.message}
                <span className="ml-1 font-mono text-[10px] text-faint">(R² {t.fitQuality})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-faint">
        Adapted from NEWS2 · {a.sampleCount} samples analysed · not a clinical tool
      </p>
    </div>
  );
}
