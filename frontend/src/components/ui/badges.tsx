import clsx from "clsx";
import type { AlertStatus, HealthStatus, MissionStatus } from "@/lib/api/types";

const BASE =
  "inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-[12px] font-medium whitespace-nowrap ring-1 ring-inset";

export const HEALTH_TEXT: Record<HealthStatus, string> = {
  Nominal: "text-nominal",
  Caution: "text-caution",
  Critical: "text-critical",
  Unknown: "text-muted",
};

/** Theme-aware colours for SVG strokes/fills and inline styles. */
export const HEALTH_COLOR: Record<HealthStatus, string> = {
  Nominal: "var(--color-nominal)",
  Caution: "var(--color-caution)",
  Critical: "var(--color-critical)",
  Unknown: "var(--color-faint)",
};

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  Nominal: "Nominal",
  Caution: "Caution",
  Critical: "Critical",
  Unknown: "No data",
};

const HEALTH_STYLES: Record<HealthStatus, string> = {
  Nominal: "bg-nominal/[0.08] text-nominal ring-nominal/20",
  Caution: "bg-caution/[0.09] text-caution ring-caution/25",
  Critical: "bg-critical/[0.09] text-critical ring-critical/25",
  Unknown: "bg-panel-raised text-muted ring-line",
};

/** A solid status dot. Only critical gets the (soft) pulse, so it is the one thing that moves. */
export function StatusDot({ status, className }: { status: HealthStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-block size-[7px] shrink-0 rounded-full bg-current",
        status === "Critical" && "animate-pulse-soft",
        HEALTH_TEXT[status],
        className,
      )}
    />
  );
}

export function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span className={clsx(BASE, HEALTH_STYLES[status])}>
      <StatusDot status={status} className="!size-1.5" />
      {HEALTH_LABEL[status]}
    </span>
  );
}

const ALERT_STATUS_STYLES: Record<AlertStatus, string> = {
  Open: "bg-accent/[0.08] text-accent ring-accent/20",
  Acknowledged: "bg-panel-raised text-ink ring-line-strong",
  Resolved: "bg-panel-raised text-muted ring-line",
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return <span className={clsx(BASE, ALERT_STATUS_STYLES[status])}>{status}</span>;
}

const MISSION_STATUS_STYLES: Record<MissionStatus, string> = {
  Planned: "bg-panel-raised text-muted ring-line",
  Active: "bg-nominal/[0.08] text-nominal ring-nominal/20",
  Completed: "bg-panel-raised text-ink ring-line-strong",
  Aborted: "bg-critical/[0.08] text-critical ring-critical/20",
};

export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  return (
    <span className={clsx(BASE, MISSION_STATUS_STYLES[status])}>
      {status === "Active" && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {status === "Active" ? "In flight" : status}
    </span>
  );
}
