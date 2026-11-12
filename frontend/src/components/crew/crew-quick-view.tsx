"use client";

import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AlertList } from "@/components/alerts/alert-list";
import { AssessmentPanel } from "@/components/monitor/early-warning";
import { CrewAvatar } from "@/components/ui/avatar";
import { HEALTH_COLOR, HEALTH_TEXT, HealthBadge } from "@/components/ui/badges";
import { RangeBar, Sparkline } from "@/components/ui/data-viz";
import { Drawer } from "@/components/ui/dialog";
import { LiveValue } from "@/components/ui/live-value";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { useAlerts, useAstronauts, useThresholds } from "@/lib/api/queries";
import type { Threshold, VitalReading } from "@/lib/api/types";
import { humanize, timeAgo } from "@/lib/format";
import { useLiveVitals } from "@/lib/realtime/hooks";
import { METRIC_VALUE, classify, describeRange } from "@/lib/vitals";

/**
 * Side sheet with everything a flight surgeon needs about one person, without leaving the page:
 * live vitals against their safe bands, early-warning breakdown and open alerts.
 */
export function CrewQuickView({ astronautId, onClose }: { astronautId: string | null; onClose: () => void }) {
  const crew = useAstronauts({ pageSize: 100 });
  const astronaut = crew.data?.items.find((a) => a.id === astronautId);

  return (
    <Drawer
      open={astronautId !== null}
      onClose={onClose}
      width="30rem"
      title={astronaut ? `${astronaut.firstName} ${astronaut.lastName}` : "Crew member"}
      headerAction={
        astronautId && (
          <Link
            href={`/crew/${astronautId}`}
            onClick={onClose}
            className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-overlay/[0.06] hover:text-ink"
          >
            Full profile <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        )
      }
    >
      {astronautId && <QuickViewBody astronautId={astronautId} />}
    </Drawer>
  );
}

function QuickViewBody({ astronautId }: { astronautId: string }) {
  const crew = useAstronauts({ pageSize: 100 });
  const a = crew.data?.items.find((x) => x.id === astronautId);
  const thresholds = useThresholds();
  const { readings } = useLiveVitals(astronautId);
  const latest = readings.at(-1);
  const alerts = useAlerts({ astronautId, status: "Open", page: 1, pageSize: 5 });

  if (!a) return <Skeleton className="m-5 h-64" />;

  return (
    <div className="divide-y divide-line">
      <section className="flex items-center gap-4 px-5 py-5">
        <CrewAvatar firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <HealthBadge status={a.healthStatus} />
            {a.openAlerts > 0 && <span className="text-[12px] text-muted">{a.openAlerts} open alerts</span>}
          </div>
          <p className="mt-1.5 truncate text-[13px] text-muted">
            {humanize(a.role)} · {a.agency} · {a.missionName ?? "Unassigned"}
          </p>
          <p className="mt-0.5 text-[12px] text-faint">Last reading {timeAgo(latest?.recordedAtUtc ?? a.lastReadingAtUtc)}</p>
        </div>
      </section>

      <section className="px-5 py-5">
        <h3 className="mb-3 text-[13px] font-semibold text-ink">Vitals</h3>
        {latest && thresholds.data ? (
          <div className="grid grid-cols-2 gap-2">
            {thresholds.data.map((t) => (
              <VitalCard key={t.metric} threshold={t} latest={latest} readings={readings} />
            ))}
          </div>
        ) : (
          <EmptyState title="No telemetry yet" />
        )}
      </section>

      <section className="px-5 py-5">
        <h3 className="mb-3 text-[13px] font-semibold text-ink">Early warning</h3>
        <AssessmentPanel astronautId={astronautId} />
      </section>

      <section className="px-5 py-5">
        <h3 className="mb-3 text-[13px] font-semibold text-ink">Open alerts</h3>
        {alerts.isPending ? (
          <Skeleton className="h-24" />
        ) : alerts.data?.items.length ? (
          <AlertList alerts={alerts.data.items} showAstronaut={false} compact />
        ) : (
          <p className="rounded-lg bg-panel-raised px-3 py-2.5 text-[13px] text-muted">No open alerts for this crew member.</p>
        )}
      </section>
    </div>
  );
}

function VitalCard({ threshold, latest, readings }: { threshold: Threshold; latest: VitalReading; readings: VitalReading[] }) {
  const value = METRIC_VALUE[threshold.metric](latest);
  const status = classify(value, threshold);
  const flagged = status === "Critical" || status === "Caution";

  return (
    <div className={clsx("rounded-lg border p-3", flagged ? "border-current/20" : "border-line", flagged && HEALTH_TEXT[status])}>
      <p className="truncate text-[12px] font-medium text-muted" title={threshold.label}>
        {threshold.label}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className={clsx("text-[20px] leading-tight font-semibold tracking-tight", flagged ? HEALTH_TEXT[status] : "text-ink")}>
          <LiveValue value={value}>{value}</LiveValue>
          <span className="ml-1 text-[11px] font-normal text-muted">{threshold.unit}</span>
        </p>
        <div className="w-16">
          <Sparkline
            values={readings.map((r) => METRIC_VALUE[threshold.metric](r))}
            color={flagged ? HEALTH_COLOR[status] : "var(--color-faint)"}
            height={22}
            fill={false}
          />
        </div>
      </div>
      <RangeBar value={value} threshold={threshold} status={status} />
      <p className="mt-1.5 truncate text-[11px] text-faint">Safe {describeRange(threshold)}</p>
    </div>
  );
}
