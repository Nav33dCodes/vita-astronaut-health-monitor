"use client";

import clsx from "clsx";
import { Heart } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CrewAvatar } from "@/components/ui/avatar";
import { HEALTH_COLOR, HEALTH_TEXT, HealthBadge } from "@/components/ui/badges";
import { Sparkline } from "@/components/ui/data-viz";
import { EwsBadge } from "@/components/ui/ews";
import type { AstronautSummary, HealthStatus, Threshold, VitalMetric } from "@/lib/api/types";
import { humanize } from "@/lib/format";
import { useLiveVitals, useSignalQuality, type SignalQuality } from "@/lib/realtime/hooks";
import { classify } from "@/lib/vitals";

const SIGNAL_STYLE: Record<SignalQuality, { label: string; className: string }> = {
  live: { label: "Live", className: "text-nominal border-nominal/30" },
  stale: { label: "Stale", className: "text-caution border-caution/35" },
  lost: { label: "No signal", className: "text-critical border-critical/40" },
};

const SEVERITY_ORDER: HealthStatus[] = ["Unknown", "Nominal", "Caution", "Critical"];
const worst = (a: HealthStatus, b: HealthStatus) => (SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b);

/** Bedside-monitor style tile: big heart rate, live trace, and every vital colour-coded. */
export function MonitorTile({ astronaut: a, thresholds }: { astronaut: AstronautSummary; thresholds: Threshold[] }) {
  const { readings, isLoading } = useLiveVitals(a.id);
  const latest = readings.at(-1);
  const { quality, ageSeconds } = useSignalQuality(latest?.recordedAtUtc);
  const find = (metric: VitalMetric) => thresholds.find((t) => t.metric === metric);
  const status = (metric: VitalMetric, value: number | undefined): HealthStatus =>
    value === undefined ? "Unknown" : classify(value, find(metric));

  const hrStatus = status("HeartRate", latest?.heartRateBpm);
  const traceColor = hrStatus === "Nominal" ? "var(--color-nominal)" : HEALTH_COLOR[hrStatus];
  const signal = SIGNAL_STYLE[quality];
  const beat = latest ? ({ "--beat": `${60 / Math.max(latest.heartRateBpm, 30)}s` } as CSSProperties) : undefined;

  return (
    <Link
      href={`/crew/${a.id}`}
      className={clsx(
        "glass group flex flex-col rounded-2xl p-4 transition hover:border-accent/30",
        a.healthStatus === "Critical" && "glow-critical",
        a.healthStatus === "Caution" && "glow-caution",
      )}
    >
      <div className="flex items-center gap-3">
        <CrewAvatar firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink group-hover:text-accent">
            {a.firstName} {a.lastName}
          </p>
          <p className="truncate text-[11px] text-muted">
            {humanize(a.role)} · {a.missionName ?? "Unassigned"}
          </p>
        </div>
        <span
          className={clsx(
            "flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase",
            signal.className,
          )}
        >
          <span aria-hidden className={clsx("size-1.5 rounded-full bg-current", quality === "live" && "animate-blink")} />
          {signal.label}
        </span>
      </div>

      {/* Heart rate + live trace */}
      <div className="mt-4 flex items-end gap-4">
        <div className="shrink-0">
          <p className="hud-label !text-[9px]">HR · bpm</p>
          <div className="flex items-center gap-2">
            <Heart
              aria-hidden
              className={clsx("size-5 fill-current", HEALTH_TEXT[hrStatus], latest && quality !== "lost" && "animate-heartbeat")}
              style={beat}
            />
            <span
              key={latest?.id}
              className={clsx("animate-tick font-mono text-4xl font-semibold tabular-nums", HEALTH_TEXT[hrStatus])}
            >
              {latest?.heartRateBpm ?? "—"}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1 pb-1">
          {readings.length > 1 ? (
            <Sparkline values={readings.map((r) => r.heartRateBpm)} color={traceColor} height={48} />
          ) : (
            <div className="grid h-12 place-items-center font-mono text-[10px] text-faint">
              {isLoading ? "Acquiring…" : "No telemetry"}
            </div>
          )}
        </div>
      </div>

      {/* Secondary vitals */}
      <dl className="mt-4 grid grid-cols-5 gap-1.5 border-t border-line pt-3">
        <Cell
          label="SpO₂"
          value={latest?.oxygenSaturationPct}
          unit="%"
          status={status("OxygenSaturation", latest?.oxygenSaturationPct)}
          tickKey={latest?.id}
        />
        <Cell
          label="BP"
          value={latest ? `${latest.systolicMmHg}/${latest.diastolicMmHg}` : undefined}
          status={worst(status("SystolicPressure", latest?.systolicMmHg), status("DiastolicPressure", latest?.diastolicMmHg))}
          tickKey={latest?.id}
        />
        <Cell
          label="Temp"
          value={latest?.bodyTemperatureC}
          unit="°"
          status={status("BodyTemperature", latest?.bodyTemperatureC)}
          tickKey={latest?.id}
        />
        <Cell
          label="Resp"
          value={latest?.respiratoryRatePerMin}
          status={status("RespiratoryRate", latest?.respiratoryRatePerMin)}
          tickKey={latest?.id}
        />
        <Cell
          label="Rad"
          value={latest?.radiationDoseMsv}
          status={status("RadiationDose", latest?.radiationDoseMsv)}
          tickKey={latest?.id}
        />
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <HealthBadge status={a.healthStatus} />
          {latest && <EwsBadge score={latest.earlyWarningScore} risk={latest.earlyWarningRisk} />}
        </span>
        <span className="font-mono text-[10px] text-faint">
          {ageSeconds === null ? "awaiting packet" : `pkt ${ageSeconds}s ago`} · {a.openAlerts} alert
          {a.openAlerts === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}

function Cell({
  label,
  value,
  unit,
  status,
  tickKey,
}: {
  label: string;
  value: number | string | undefined;
  unit?: string;
  status: HealthStatus;
  tickKey?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="hud-label !text-[8.5px] !tracking-[0.1em]">{label}</dt>
      <dd
        key={tickKey}
        className={clsx(
          "animate-tick truncate font-mono text-[13px] font-medium",
          status === "Unknown" ? "text-ink" : HEALTH_TEXT[status],
        )}
      >
        {value ?? "—"}
        {value !== undefined && unit && <span className="text-[9px] text-muted">{unit}</span>}
      </dd>
    </div>
  );
}
