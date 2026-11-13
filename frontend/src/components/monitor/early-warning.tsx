"use client";

import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Timer } from "lucide-react";
import Link from "next/link";
import { Pager } from "@/components/ui/pager";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { EwsBadge, RISK_BG, RISK_LABEL, RISK_TEXT } from "@/components/ui/ews";
import { useAssessment, useEarlyWarningScoring, useFleetAssessments } from "@/lib/api/queries";
import type { Trend } from "@/lib/api/types";
import { METRIC_LABELS } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import { SkeletonList, SkeletonText } from "@/components/ui/skeleton";

/** Compact trend chip: arrow, metric, rate and (if any) time until the safe limit is crossed. */
export function TrendChip({ trend }: { trend: Trend }) {
  const Arrow = trend.direction === "Rising" ? ArrowUpRight : ArrowDownRight;
  const watch = trend.severity === "Watch";
  return (
    <span
      title={trend.message}
      className={clsx(
        "tnum inline-flex h-[22px] items-center gap-1 rounded-md px-1.5 text-[11.5px] font-medium whitespace-nowrap ring-1 ring-inset",
        watch ? "bg-caution/[0.08] text-caution ring-caution/20" : "bg-panel-raised text-muted ring-line",
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

/**
 * Predictive watchlist: crew whose vitals are drifting toward a limit, soonest crossing first.
 * Complements the score, which only describes "now".
 */
export function TrendWatch({ onSelect, limit = 5 }: { onSelect?: (id: string) => void; limit?: number }) {
  const fleet = useFleetAssessments();

  if (fleet.isPending) return <SkeletonList rows={3} actions={false} />;
  if (fleet.isError) return <ErrorState error={fleet.error} onRetry={() => fleet.refetch()} />;

  const soonest = (trends: Trend[]) => Math.min(...trends.map((t) => t.minutesToLimit ?? Infinity));
  const drifting = fleet.data
    .filter((a) => a.trends.length > 0)
    .sort((a, b) => soonest(a.trends) - soonest(b.trends) || (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  if (drifting.length === 0) {
    return <EmptyState title="No sustained drift">All vitals have been stable over the last 60 minutes.</EmptyState>;
  }

  return (
    <ul className="divide-y divide-line">
      {drifting.map((a) => (
        <li key={a.astronautId}>
          <button
            onClick={() => onSelect?.(a.astronautId)}
            className="flex w-full items-center gap-3 py-2.5 text-left transition-opacity hover:opacity-80"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-ink">{a.astronautName}</span>
              <span className="mt-1 flex flex-wrap gap-1">
                {a.trends.slice(0, 2).map((t) => (
                  <TrendChip key={t.metric} trend={t} />
                ))}
              </span>
            </span>
            {a.score !== null && a.risk && <EwsBadge score={a.score} risk={a.risk} />}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Fleet early-warning ranking, most at-risk first, with a score bar per person. */
export function EarlyWarningBoard({ pageSize = 5 }: { pageSize?: number }) {
  const fleet = useFleetAssessments();
  const scoring = useEarlyWarningScoring();
  const { page, setPage, totalPages, pageItems } = usePagination(fleet.data ?? [], pageSize);
  const max = scoring.data?.maxScore ?? 15;

  if (fleet.isPending) return <SkeletonList rows={5} actions={false} />;
  if (fleet.isError) return <ErrorState error={fleet.error} onRetry={() => fleet.refetch()} />;
  if (fleet.data.length === 0) return <EmptyState title="No telemetry to assess yet" />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="divide-y divide-line">
        {pageItems.map((a) => (
          <li key={a.astronautId}>
            <Link href={`/crew/${a.astronautId}`} className="flex items-center gap-3 py-2.5 transition-opacity hover:opacity-80">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-ink">{a.astronautName}</span>
                <span className={clsx("block text-[12px]", a.risk ? RISK_TEXT[a.risk] : "text-muted")}>
                  {a.risk ? `${RISK_LABEL[a.risk]} risk` : "No score"}
                </span>
              </span>
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-track" aria-hidden>
                <span
                  className={clsx("block h-full rounded-full", a.risk ? RISK_BG[a.risk] : "bg-faint")}
                  style={{ width: `${((a.score ?? 0) / max) * 100}%` }}
                />
              </span>
              <span className={clsx("tnum w-6 text-right text-[15px] font-semibold", a.risk ? RISK_TEXT[a.risk] : "text-muted")}>
                {a.score ?? "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Pager variant="compact" page={page} totalPages={totalPages} onPageChange={setPage} className="mt-auto self-end pt-2" />
    </div>
  );
}

const POINT_STYLE = ["bg-nominal/60", "bg-caution/70", "bg-caution", "bg-critical"];

/** Detailed early-warning breakdown for one astronaut. */
export function AssessmentPanel({ astronautId }: { astronautId: string }) {
  const assessment = useAssessment(astronautId);
  const scoring = useEarlyWarningScoring();

  if (assessment.isPending)
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-24" />
        <SkeletonText lines={5} />
      </div>
    );
  if (assessment.isError) return <ErrorState error={assessment.error} onRetry={() => assessment.refetch()} />;

  const a = assessment.data;
  if (a.score === null || a.risk === null) return <EmptyState title="No readings to score yet" />;

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3">
        <p className={clsx("tnum text-[40px] leading-none font-semibold tracking-tight", RISK_TEXT[a.risk])}>{a.score}</p>
        <div className="pb-0.5">
          <p className="text-[12px] text-muted">of {scoring.data?.maxScore ?? "–"} · early warning score</p>
          <p className={clsx("text-[13px] font-medium", RISK_TEXT[a.risk])}>{RISK_LABEL[a.risk]} risk</p>
        </div>
      </div>

      <dl className="space-y-2">
        {a.components.map((c) => (
          <div key={c.metric} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-[13px]">
            <dt className="text-muted">{METRIC_LABELS[c.metric]}</dt>
            <dd className="tnum text-ink">{c.value}</dd>
            <dd className="flex gap-0.5" aria-label={`${c.points} points`}>
              {[1, 2, 3].map((i) => (
                <span key={i} className={clsx("h-1.5 w-4 rounded-full", i <= c.points ? POINT_STYLE[c.points] : "bg-track")} />
              ))}
            </dd>
          </div>
        ))}
      </dl>

      <div>
        <p className="mb-2 text-[12px] font-medium text-muted">Trends · last {a.windowMinutes} min</p>
        {a.trends.length === 0 ? (
          <p className="rounded-lg bg-panel-raised px-3 py-2.5 text-[13px] text-muted">All vitals stable. No sustained drift detected.</p>
        ) : (
          <ul className="space-y-1.5">
            {a.trends.map((t) => (
              <li
                key={t.metric}
                className={clsx(
                  "rounded-lg px-3 py-2 text-[13px]",
                  t.severity === "Watch" ? "bg-caution/[0.08] text-ink ring-1 ring-caution/20 ring-inset" : "bg-panel-raised text-muted",
                )}
              >
                {t.message}
                <span className="tnum ml-1 text-[11.5px] text-faint">(R² {t.fitQuality})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11.5px] leading-relaxed text-faint">
        Adapted from NEWS2 · {a.sampleCount} samples analysed · not a clinical tool
      </p>
    </div>
  );
}
