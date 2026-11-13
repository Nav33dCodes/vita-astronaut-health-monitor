"use client";

import clsx from "clsx";
import { HEALTH_COLOR, HEALTH_TEXT, HealthBadge } from "@/components/ui/badges";
import { CrewAvatar } from "@/components/ui/avatar";
import { Sparkline } from "@/components/ui/data-viz";
import { EwsBadge } from "@/components/ui/ews";
import { LiveValue } from "@/components/ui/live-value";
import type { AstronautSummary, HealthStatus, Threshold } from "@/lib/api/types";
import { humanize } from "@/lib/format";
import { useLiveVitals, useSignalQuality, type SignalQuality } from "@/lib/realtime/hooks";
import { bloodPressureStatus, statusOf } from "@/lib/vitals";

const SIGNAL: Record<SignalQuality, { label: string; dot: string; text: string }> = {
  live: { label: "Live", dot: "bg-nominal", text: "text-muted" },
  stale: { label: "Stale", dot: "bg-caution", text: "text-caution" },
  lost: { label: "No signal", dot: "bg-faint", text: "text-faint" },
};

/** Bedside-monitor tile: big heart rate with its trace, every other vital in a quiet grid. */
export function MonitorTile({
  astronaut: a,
  thresholds,
  onSelect,
}: {
  astronaut: AstronautSummary;
  thresholds: Threshold[];
  onSelect?: (id: string) => void;
}) {
  const { readings, isLoading } = useLiveVitals(a.id);
  const latest = readings.at(-1);
  const hrStatus = statusOf("HeartRate", latest, thresholds);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(a.id)}
      className={clsx(
        "glass group flex w-full flex-col rounded-[var(--radius-card)] p-4 text-left transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[var(--shadow-pop)]",
        a.healthStatus === "Critical" && "glow-critical",
        a.healthStatus === "Caution" && "glow-caution",
      )}
    >
      <div className="flex w-full items-center gap-3">
        <CrewAvatar firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium text-ink">
            {a.firstName} {a.lastName}
          </p>
          <p className="truncate text-[12px] text-muted">
            {humanize(a.role)} · {a.missionName ?? "Unassigned"}
          </p>
        </div>
        <HealthBadge status={a.healthStatus} />
      </div>

      <div className="mt-4 flex w-full items-end gap-4">
        <div className="shrink-0">
          <p className="text-[12px] font-medium text-muted">Heart rate</p>
          <p className={clsx("mt-0.5 text-[34px] leading-none font-semibold tracking-tight", hrStatus === "Nominal" || hrStatus === "Unknown" ? "text-ink" : HEALTH_TEXT[hrStatus])}>
            {latest ? <LiveValue value={latest.heartRateBpm}>{latest.heartRateBpm}</LiveValue> : <span className="text-faint">—</span>}
            <span className="ml-1 text-[12px] font-normal tracking-normal text-muted">bpm</span>
          </p>
        </div>
        <div className="min-w-0 flex-1 pb-0.5">
          {readings.length > 1 ? (
            <Sparkline
              values={readings.map((r) => r.heartRateBpm)}
              color={hrStatus === "Nominal" || hrStatus === "Unknown" ? "var(--color-accent)" : HEALTH_COLOR[hrStatus]}
              height={40}
            />
          ) : (
            <div className="grid h-10 place-items-center text-[12px] text-faint">{isLoading ? "Acquiring…" : "No telemetry"}</div>
          )}
        </div>
      </div>

      <dl className="mt-4 grid w-full grid-cols-[repeat(5,auto)] justify-between gap-x-2 border-t border-line pt-3">
        <Cell label="SpO₂" value={latest?.oxygenSaturationPct} unit="%" status={statusOf("OxygenSaturation", latest, thresholds)} />
        <Cell label="BP" value={latest ? `${latest.systolicMmHg}/${latest.diastolicMmHg}` : undefined} status={bloodPressureStatus(latest, thresholds)} />
        <Cell label="Temp" value={latest?.bodyTemperatureC} unit="°" status={statusOf("BodyTemperature", latest, thresholds)} />
        <Cell label="Resp" value={latest?.respiratoryRatePerMin} status={statusOf("RespiratoryRate", latest, thresholds)} />
        <Cell
          label="mSv/d"
          value={latest?.radiationDoseRateMsvPerDay ?? undefined}
          status={statusOf("RadiationDose", latest?.radiationDoseRateMsvPerDay == null ? undefined : latest, thresholds)}
        />
      </dl>

      <div className="mt-3 flex w-full items-center justify-between gap-2 text-[12px]">
        <SignalStatus lastPacketIso={latest?.recordedAtUtc} />
        <span className="flex items-center gap-2 text-muted">
          {a.openAlerts > 0 && (
            <span>
              <span className="tnum font-medium text-ink">{a.openAlerts}</span> alert{a.openAlerts === 1 ? "" : "s"}
            </span>
          )}
          {latest && <EwsBadge score={latest.earlyWarningScore} risk={latest.earlyWarningRisk} />}
        </span>
      </div>
    </button>
  );
}

function Cell({ label, value, unit, status }: { label: string; value: number | string | undefined; unit?: string; status: HealthStatus }) {
  const flagged = status === "Critical" || status === "Caution";
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className={clsx("text-[12.5px] whitespace-nowrap", flagged ? clsx("font-semibold", HEALTH_TEXT[status]) : "font-medium text-ink")}>
        {value === undefined ? (
          <span className="text-faint">—</span>
        ) : (
          <LiveValue value={value}>
            {value}
            {unit && <span className="text-[11px] font-normal text-muted">{unit}</span>}
          </LiveValue>
        )}
      </dd>
    </div>
  );
}

/** Packet freshness on the shared one-second clock; isolated so the tile body doesn't re-render. */
function SignalStatus({ lastPacketIso }: { lastPacketIso: string | undefined }) {
  const { quality, ageSeconds } = useSignalQuality(lastPacketIso);
  const signal = SIGNAL[quality];
  return (
    <span className={clsx("flex items-center gap-1.5", signal.text)}>
      <span aria-hidden className={clsx("size-1.5 rounded-full", signal.dot)} />
      {signal.label}
      {ageSeconds !== null && <span className="tnum text-faint">· {ageSeconds}s ago</span>}
    </span>
  );
}
