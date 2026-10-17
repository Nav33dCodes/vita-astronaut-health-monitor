"use client";

import clsx from "clsx";
import Link from "next/link";
import { CrewAvatar } from "@/components/ui/avatar";
import { HEALTH_COLOR, HealthBadge } from "@/components/ui/badges";
import { Sparkline } from "@/components/ui/data-viz";
import { useLiveVitals } from "@/lib/realtime/hooks";
import type { AstronautSummary } from "@/lib/api/types";
import { humanize, timeAgo } from "@/lib/format";

/** Crew member tile with a 24h heart-rate sparkline and headline vitals. */
export function CrewCard({ astronaut: a }: { astronaut: AstronautSummary }) {
  const { readings } = useLiveVitals(a.id);
  const latest = readings.at(-1);
  const color = a.healthStatus === "Nominal" || a.healthStatus === "Unknown" ? "var(--color-accent)" : HEALTH_COLOR[a.healthStatus];

  return (
    <Link
      href={`/crew/${a.id}`}
      className={clsx(
        "glass group block rounded-2xl p-4 transition duration-300 hover:-translate-y-0.5 hover:border-accent/30",
        a.healthStatus === "Critical" && "glow-critical",
        a.healthStatus === "Caution" && "glow-caution",
      )}
    >
      <div className="flex items-start gap-3">
        <CrewAvatar firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink group-hover:text-accent">
            {a.firstName} {a.lastName}
          </p>
          <p className="truncate text-xs text-muted">
            {humanize(a.role)} · {a.agency}
          </p>
        </div>
        <HealthBadge status={a.healthStatus} />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="hud-label !text-[9px]">Heart rate · live</span>
          <span className="font-mono text-[10px] text-faint">{timeAgo(a.lastReadingAtUtc)}</span>
        </div>
        {readings.length > 1 ? (
          <Sparkline values={readings.map((r) => r.heartRateBpm)} color={color} />
        ) : (
          <div className="grid h-10 place-items-center font-mono text-[10px] text-faint">No telemetry</div>
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
      <dt className="hud-label !text-[9px]">{label}</dt>
      <dd className="font-mono text-sm text-ink">
        {value ?? "—"}
        {value !== undefined && <span className="ml-0.5 text-[10px] text-muted">{unit}</span>}
      </dd>
    </div>
  );
}
