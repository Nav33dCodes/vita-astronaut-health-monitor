import clsx from "clsx";
import type { AlertStatus, HealthStatus, MissionStatus } from "@/lib/api/types";

const BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-medium tracking-wider uppercase whitespace-nowrap";

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

const HEALTH_STYLES: Record<HealthStatus, string> = {
  Nominal: "border-nominal/30 bg-nominal/10 text-nominal",
  Caution: "border-caution/35 bg-caution/10 text-caution",
  Critical: "border-critical/50 bg-critical/15 text-critical",
  Unknown: "border-line-strong bg-overlay/[0.03] text-muted",
};

export function StatusDot({ status, className }: { status: HealthStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-block size-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]",
        status === "Critical" && "animate-blink",
        HEALTH_TEXT[status],
        className,
      )}
    />
  );
}

export function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span className={clsx(BASE, HEALTH_STYLES[status])}>
      <StatusDot status={status} />
      {status}
    </span>
  );
}

const ALERT_STATUS_STYLES: Record<AlertStatus, string> = {
  Open: "border-accent/40 bg-accent/10 text-accent",
  Acknowledged: "border-violet/40 bg-violet/10 text-violet",
  Resolved: "border-line-strong bg-overlay/[0.03] text-muted",
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return <span className={clsx(BASE, ALERT_STATUS_STYLES[status])}>{status}</span>;
}

const MISSION_STATUS_STYLES: Record<MissionStatus, string> = {
  Planned: "border-line-strong bg-overlay/[0.03] text-muted",
  Active: "border-accent/40 bg-accent/10 text-accent",
  Completed: "border-nominal/30 bg-nominal/10 text-nominal",
  Aborted: "border-critical/40 bg-critical/10 text-critical",
};

export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  return (
    <span className={clsx(BASE, MISSION_STATUS_STYLES[status])}>
      {status === "Active" && <span aria-hidden className="size-1.5 animate-blink rounded-full bg-current" />}
      {status}
    </span>
  );
}
