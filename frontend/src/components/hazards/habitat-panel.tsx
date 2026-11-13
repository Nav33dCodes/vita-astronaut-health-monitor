"use client";

import clsx from "clsx";
import { useMemo } from "react";
import { HEALTH_COLOR, HEALTH_TEXT } from "@/components/ui/badges";
import { Sparkline } from "@/components/ui/data-viz";
import { LiveValue } from "@/components/ui/live-value";
import { Skeleton } from "@/components/ui/primitives";
import { useHabitatHistory, useHabitatThresholds } from "@/lib/api/queries";
import type { HabitatReading, HabitatThreshold, HealthStatus } from "@/lib/api/types";
import { HABITAT_SHORT, HABITAT_VALUE } from "@/lib/hazards";
import { useLiveHabitat } from "@/lib/realtime/store";

/** History from the API merged with readings pushed live, oldest first. */
export function useHabitatSeries(missionId: string, minutes = 30): { readings: HabitatReading[]; isLoading: boolean } {
  const history = useHabitatHistory(missionId, minutes);
  const live = useLiveHabitat(missionId);
  const readings = useMemo(() => {
    const seen = new Set<string>();
    return [...(history.data ?? []), ...live]
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      .sort((a, b) => a.recordedAtUtc.localeCompare(b.recordedAtUtc))
      .slice(-180);
  }, [history.data, live]);
  return { readings, isLoading: history.isPending };
}

function classify(value: number, t: HabitatThreshold): HealthStatus {
  if ((t.criticalLow !== null && value < t.criticalLow) || (t.criticalHigh !== null && value > t.criticalHigh)) return "Critical";
  if ((t.warningLow !== null && value < t.warningLow) || (t.warningHigh !== null && value > t.warningHigh)) return "Caution";
  return "Nominal";
}

function range(t: HabitatThreshold) {
  if (t.warningLow !== null && t.warningHigh !== null) return `${t.warningLow}–${t.warningHigh}`;
  if (t.warningHigh !== null) return `≤ ${t.warningHigh}`;
  if (t.warningLow !== null) return `≥ ${t.warningLow}`;
  return "";
}

/** Six live tiles for the cabin environment of one spacecraft. */
export function HabitatPanel({ missionId }: { missionId: string }) {
  const { readings, isLoading } = useHabitatSeries(missionId);
  const thresholds = useHabitatThresholds();
  const latest = readings.at(-1);

  if (isLoading || thresholds.isPending) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
    );
  }

  if (!latest || !thresholds.data) {
    return <p className="rounded-lg bg-panel-raised px-3 py-3 text-[13px] text-muted">No cabin telemetry for this mission yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {thresholds.data.map((t) => {
        const value = HABITAT_VALUE[t.metric](latest);
        const status = classify(value, t);
        const flagged = status !== "Nominal";
        const decimals = t.metric === "RadiationDoseRate" ? 2 : t.metric === "Humidity" ? 0 : 1;
        return (
          <div
            key={t.metric}
            title={t.label}
            className={clsx("rounded-lg border p-3 transition-colors", flagged ? "border-current/25" : "border-line", flagged && HEALTH_TEXT[status])}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[12px] font-medium text-muted">{HABITAT_SHORT[t.metric]}</p>
              {flagged && <span className="size-1.5 shrink-0 rounded-full bg-current" aria-label={status} />}
            </div>
            <p className={clsx("mt-1 text-[20px] leading-tight font-semibold tracking-tight", flagged ? HEALTH_TEXT[status] : "text-ink")}>
              <LiveValue value={value}>{value.toFixed(decimals)}</LiveValue>
              <span className="ml-1 text-[11px] font-normal tracking-normal text-muted">{t.unit}</span>
            </p>
            <div className="mt-1.5">
              <Sparkline
                values={readings.map((r) => HABITAT_VALUE[t.metric](r))}
                color={flagged ? HEALTH_COLOR[status] : "var(--color-faint)"}
                height={20}
                fill={false}
              />
            </div>
            <p className="mt-1 truncate text-[11px] text-faint">Safe {range(t)}</p>
          </div>
        );
      })}
    </div>
  );
}
