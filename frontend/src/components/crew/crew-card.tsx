"use client";

import Link from "next/link";
import { CrewAvatar } from "@/components/ui/avatar";
import { HEALTH_COLOR, HealthBadge } from "@/components/ui/badges";
import { Sparkline } from "@/components/ui/data-viz";
import { useLiveVitals } from "@/lib/realtime/hooks";
import type { AstronautSummary } from "@/lib/api/types";
import { humanize, timeAgo } from "@/lib/format";

/** Crew member card with a live heart-rate trace and headline vitals. */
export function CrewCard({ astronaut: a }: { astronaut: AstronautSummary }) {
  const { readings } = useLiveVitals(a.id);
  const latest = readings.at(-1);
  const color = a.healthStatus === "Nominal" || a.healthStatus === "Unknown" ? "var(--color-accent)" : HEALTH_COLOR[a.healthStatus];

  return (
    <Link
      href={`/crew/${a.id}`}
      className="glass group block rounded-[var(--radius-card)] p-4 transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[var(--shadow-pop)]"
    >
      <div className="flex items-start gap-3">
        <CrewAvatar firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">
            {a.firstName} {a.lastName}
          </p>
          <p className="truncate text-[12.5px] text-muted">
            {humanize(a.role)} · {a.agency}
          </p>
        </div>
        <HealthBadge status={a.healthStatus} />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[12px]">
          <span className="font-medium text-muted">Heart rate</span>
          <span className="text-faint">{timeAgo(a.lastReadingAtUtc)}</span>
        </div>
        {readings.length > 1 ? (
          <Sparkline values={readings.map((r) => r.heartRateBpm)} color={color} height={36} />
        ) : (
          <div className="grid h-9 place-items-center text-[12px] text-faint">No telemetry</div>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
        <Metric label="HR" value={latest?.heartRateBpm} unit="bpm" />
        <Metric label="SpO₂" value={latest?.oxygenSaturationPct} unit="%" />
        <Metric label="Temp" value={latest?.bodyTemperatureC} unit="°C" />
      </dl>
    </Link>
  );
}

function Metric({ label, value, unit }: { label: string; value: number | undefined; unit: string }) {
  return (
    <div>
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="tnum text-[14px] font-medium text-ink">
        {value ?? <span className="text-faint">—</span>}
        {value !== undefined && <span className="ml-0.5 text-[11px] font-normal text-muted">{unit}</span>}
      </dd>
    </div>
  );
}
