"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { memo, useMemo, useState, type ReactNode } from "react";
import { CrewAvatar } from "@/components/ui/avatar";
import { HEALTH_COLOR, HEALTH_TEXT, HealthBadge } from "@/components/ui/badges";
import { Sparkline } from "@/components/ui/data-viz";
import { RISK_TEXT } from "@/components/ui/ews";
import { LiveValue } from "@/components/ui/live-value";
import { EmptyState } from "@/components/ui/primitives";
import type { AstronautSummary, HealthStatus, Threshold, VitalReading } from "@/lib/api/types";
import { humanize } from "@/lib/format";
import { useSignalQuality } from "@/lib/realtime/hooks";
import { SEVERITY_RANK, bloodPressureStatus, statusOf } from "@/lib/vitals";

type SortKey = "severity" | "name" | "hr" | "spo2" | "ews";
type SortState = { key: SortKey; dir: "asc" | "desc" };

interface Row {
  astronaut: AstronautSummary;
  readings: VitalReading[];
  latest: VitalReading | undefined;
}

const SORTERS: Record<SortKey, (a: Row, b: Row) => number> = {
  severity: (a, b) =>
    SEVERITY_RANK[a.astronaut.healthStatus] - SEVERITY_RANK[b.astronaut.healthStatus] ||
    (b.latest?.earlyWarningScore ?? -1) - (a.latest?.earlyWarningScore ?? -1),
  name: (a, b) => a.astronaut.lastName.localeCompare(b.astronaut.lastName),
  hr: (a, b) => (a.latest?.heartRateBpm ?? -1) - (b.latest?.heartRateBpm ?? -1),
  spo2: (a, b) => (a.latest?.oxygenSaturationPct ?? 999) - (b.latest?.oxygenSaturationPct ?? 999),
  ews: (a, b) => (a.latest?.earlyWarningScore ?? -1) - (b.latest?.earlyWarningScore ?? -1),
};

/**
 * The heart of the dashboard: one row per crew member, every vital live and colour-coded only
 * when it leaves its safe range. Click a row for the quick view.
 */
export function CrewVitalsTable({
  crew,
  thresholds,
  readings,
  onSelect,
  attentionOnly,
}: {
  crew: AstronautSummary[];
  thresholds: Threshold[];
  readings: Map<string, VitalReading[]>;
  onSelect: (id: string) => void;
  attentionOnly: boolean;
}) {
  const [sort, setSort] = useState<SortState>({ key: "severity", dir: "asc" });

  const rows = useMemo(() => {
    const list: Row[] = crew
      .filter((a) => !attentionOnly || a.healthStatus === "Critical" || a.healthStatus === "Caution")
      .map((astronaut) => {
        const r = readings.get(astronaut.id) ?? [];
        return { astronaut, readings: r, latest: r.at(-1) };
      });
    const sorter = SORTERS[sort.key];
    return list.sort((a, b) => (sort.dir === "asc" ? sorter(a, b) : sorter(b, a)));
  }, [crew, readings, sort, attentionOnly]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "severity" ? "asc" : "desc" },
    );

  if (rows.length === 0) {
    return (
      <EmptyState title={attentionOnly ? "Everyone is within safe limits" : "No crew to show"}>
        {attentionOnly ? "No crew member is in caution or critical state right now." : "Add astronauts to a mission to start monitoring."}
      </EmptyState>
    );
  }

  return (
    <>
      {/* Phones: a compact list; the full table needs room. */}
      <ul className="divide-y divide-line border-t border-line sm:hidden">
        {rows.map((row) => (
          <MobileRow key={row.astronaut.id} row={row} thresholds={thresholds} onSelect={onSelect} />
        ))}
      </ul>
      <div className="-mx-px hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left">
              <Th sticky sortKey="name" sort={sort} onSort={toggleSort}>
                Crew member
              </Th>
              <Th sortKey="severity" sort={sort} onSort={toggleSort}>
                Status
              </Th>
              <Th sortKey="hr" sort={sort} onSort={toggleSort} align="right">
                HR
              </Th>
              <Th sortKey="spo2" sort={sort} onSort={toggleSort} align="right">
                SpO₂
              </Th>
              <Th align="right">BP</Th>
              <Th align="right">Temp</Th>
              <Th align="right" className="hidden xl:table-cell">
                Resp
              </Th>
              <Th sortKey="ews" sort={sort} onSort={toggleSort} align="right">
                EWS
              </Th>
              <Th className="hidden w-36 lg:table-cell">Heart rate · 10 min</Th>
              <Th align="right" className="hidden 2xl:table-cell">
                Signal
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <CrewRow key={row.astronaut.id} astronaut={row.astronaut} readings={row.readings} thresholds={thresholds} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MobileRow({ row, thresholds, onSelect }: { row: Row; thresholds: Threshold[]; onSelect: (id: string) => void }) {
  const { astronaut: a, latest } = row;
  const chips: { label: string; value: string | undefined; status: HealthStatus }[] = [
    { label: "HR", value: latest && String(latest.heartRateBpm), status: statusOf("HeartRate", latest, thresholds) },
    { label: "SpO₂", value: latest && `${latest.oxygenSaturationPct}%`, status: statusOf("OxygenSaturation", latest, thresholds) },
    { label: "BP", value: latest && `${latest.systolicMmHg}/${latest.diastolicMmHg}`, status: bloodPressureStatus(latest, thresholds) },
    { label: "Temp", value: latest && `${latest.bodyTemperatureC}°`, status: statusOf("BodyTemperature", latest, thresholds) },
  ];
  return (
    <li>
      <button
        onClick={() => onSelect(a.id)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-overlay/[0.04]"
      >
        <CrewAvatar firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[13.5px] font-medium text-ink">
              {a.firstName} {a.lastName}
            </span>
            <HealthBadge status={a.healthStatus} />
          </span>
          <span className="tnum mt-1 flex flex-wrap gap-x-3 text-[12px] text-muted">
            {latest ? (
              chips.map((c) => (
                <span key={c.label}>
                  {c.label}{" "}
                  <span
                    className={clsx("font-medium", c.status === "Critical" || c.status === "Caution" ? HEALTH_TEXT[c.status] : "text-ink")}
                  >
                    {c.value}
                  </span>
                </span>
              ))
            ) : (
              <span className="text-faint">No telemetry</span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

const CELL = "border-b border-line px-3 py-2.5 compact:py-1.5 first:pl-5 last:pr-5 group-last:border-b-0";

function Th({
  children,
  sortKey,
  sort,
  onSort,
  align = "left",
  sticky,
  className,
}: {
  children: ReactNode;
  sortKey?: SortKey;
  sort?: SortState;
  onSort?: (key: SortKey) => void;
  align?: "left" | "right";
  sticky?: boolean;
  className?: string;
}) {
  const active = sortKey && sort?.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={clsx(
        "h-9 border-y border-line bg-canvas px-3 text-[12px] font-medium whitespace-nowrap text-muted first:pl-5 last:pr-5",
        align === "right" && "text-right",
        sticky && "sticky left-0 z-[1]",
        className,
      )}
    >
      {sortKey && onSort ? (
        <button
          onClick={() => onSort(sortKey)}
          className={clsx(
            "group/th inline-flex items-center gap-1 transition-colors hover:text-ink",
            active && "text-ink",
            align === "right" && "flex-row-reverse",
          )}
        >
          {children}
          <Icon className={clsx("size-3", active ? "opacity-100" : "opacity-0 group-hover/th:opacity-60")} aria-hidden />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

/** Memoized: re-renders only when this crew member's data (or the thresholds) change. */
const CrewRow = memo(function CrewRow({
  astronaut,
  readings,
  thresholds,
  onSelect,
}: {
  astronaut: AstronautSummary;
  readings: VitalReading[];
  thresholds: Threshold[];
  onSelect: (id: string) => void;
}) {
  const a = astronaut;
  const latest = readings.at(-1);
  const hrStatus = statusOf("HeartRate", latest, thresholds);

  return (
    <tr
      onClick={() => onSelect(a.id)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(a.id))}
      tabIndex={0}
      aria-label={`${a.firstName} ${a.lastName}, ${a.healthStatus}. Open quick view`}
      className="group cursor-pointer transition-colors duration-100 hover:bg-overlay/[0.025] focus-visible:bg-overlay/[0.04] focus-visible:outline-none"
    >
      <td
        className={clsx(
          CELL,
          "sticky left-0 z-[1] bg-panel transition-colors group-hover:bg-[color-mix(in_srgb,var(--color-panel)_97%,var(--color-overlay))]",
        )}
      >
        <div className="flex items-center gap-3">
          <CrewAvatar firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">
              {a.firstName} {a.lastName}
            </p>
            <p className="truncate text-[12px] text-muted">{humanize(a.role)}</p>
          </div>
        </div>
      </td>
      <td className={CELL}>
        <HealthBadge status={a.healthStatus} />
      </td>
      <Vital value={latest?.heartRateBpm} status={hrStatus} />
      <Vital value={latest?.oxygenSaturationPct} unit="%" status={statusOf("OxygenSaturation", latest, thresholds)} />
      <Vital
        value={latest ? `${latest.systolicMmHg}/${latest.diastolicMmHg}` : undefined}
        status={bloodPressureStatus(latest, thresholds)}
      />
      <Vital value={latest?.bodyTemperatureC} unit="°" status={statusOf("BodyTemperature", latest, thresholds)} />
      <Vital
        value={latest?.respiratoryRatePerMin}
        status={statusOf("RespiratoryRate", latest, thresholds)}
        className="hidden xl:table-cell"
      />
      <td className={clsx(CELL, "text-right")}>
        {latest ? (
          <LiveValue value={latest.earlyWarningScore} className={clsx("font-semibold", RISK_TEXT[latest.earlyWarningRisk])}>
            {latest.earlyWarningScore}
          </LiveValue>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className={clsx(CELL, "hidden lg:table-cell")}>
        {readings.length > 1 ? (
          <Sparkline
            values={readings.map((r) => r.heartRateBpm)}
            color={hrStatus === "Nominal" || hrStatus === "Unknown" ? "var(--color-muted)" : HEALTH_COLOR[hrStatus]}
            height={24}
            fill={false}
          />
        ) : (
          <span className="text-[12px] text-faint">No telemetry</span>
        )}
      </td>
      <td className={clsx(CELL, "hidden text-right whitespace-nowrap 2xl:table-cell")}>
        <SignalAge lastPacketIso={latest?.recordedAtUtc} />
      </td>
    </tr>
  );
});

/** Ticks every second on the shared clock; isolated so the rest of the row stays still. */
function SignalAge({ lastPacketIso }: { lastPacketIso: string | undefined }) {
  const { quality, ageSeconds } = useSignalQuality(lastPacketIso);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 text-[12px]",
        quality === "live" ? "text-muted" : quality === "stale" ? "text-caution" : "text-faint",
      )}
    >
      <span aria-hidden className={clsx("size-1.5 rounded-full", quality === "live" ? "bg-nominal" : quality === "stale" ? "bg-caution" : "bg-faint")} />
      <span className="tnum">{ageSeconds === null ? "No signal" : ageSeconds < 60 ? `${ageSeconds}s` : `${Math.round(ageSeconds / 60)}m`}</span>
    </span>
  );
}

function Vital({
  value,
  unit,
  status,
  className,
}: {
  value: number | string | undefined;
  unit?: string;
  status: HealthStatus;
  className?: string;
}) {
  const flagged = status === "Critical" || status === "Caution";
  return (
    <td className={clsx(CELL, "text-right whitespace-nowrap", className)}>
      {value === undefined ? (
        <span className="text-faint">—</span>
      ) : (
        <LiveValue value={value} className={clsx(flagged ? clsx("font-semibold", HEALTH_TEXT[status]) : "text-ink")}>
          {value}
          {unit && <span className={clsx("ml-px text-[11px]", flagged ? "opacity-70" : "text-faint")}>{unit}</span>}
        </LiveValue>
      )}
    </td>
  );
}
