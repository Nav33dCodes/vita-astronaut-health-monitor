import clsx from "clsx";
import { CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AlertStatusBadge } from "@/components/ui/badges";
import { EscalationBadge } from "@/components/ui/ews";
import { Checkbox } from "@/components/ui/primitives";
import type { Alert } from "@/lib/api/types";
import { METRIC_LABELS, timeAgo } from "@/lib/format";
import { OnboardActionsButton } from "@/components/hazards/onboard-actions";
import { AlertActions } from "./alert-actions";

/** Severity icon used across alert views. */
export function SeverityIcon({ alert, className }: { alert: Alert; className?: string }) {
  const resolved = alert.status === "Resolved";
  const critical = alert.severity === "Critical";
  const Icon = resolved ? CircleCheck : critical ? OctagonAlert : TriangleAlert;
  return (
    <Icon
      aria-label={resolved ? "Resolved" : alert.severity}
      className={clsx("size-4 shrink-0", resolved ? "text-faint" : critical ? "text-critical" : "text-caution", className)}
    />
  );
}

/** Alert rows: severity, message, who/what/when, and inline actions. */
export function AlertList({
  alerts,
  showAstronaut = true,
  compact = false,
  dense = false,
  selected,
  onToggle,
  onSelectAstronaut,
}: {
  alerts: Alert[];
  showAstronaut?: boolean;
  /** Hides the status badge (for views already filtered to one status). */
  compact?: boolean;
  /** Single-line rows for tight cards. */
  dense?: boolean;
  /** Enables row checkboxes for bulk actions. */
  selected?: ReadonlySet<string>;
  onToggle?: (id: string, checked: boolean) => void;
  /** Opens the quick view instead of navigating to the profile. */
  onSelectAstronaut?: (id: string) => void;
}) {
  return (
    <ul className="@container divide-y divide-line">
      {alerts.map((alert) => {
        const resolved = alert.status === "Resolved";
        const escalated = alert.escalationLevel > 0 && alert.status === "Open";
        const isSelected = selected?.has(alert.id) ?? false;

        return (
          <li
            key={alert.id}
            className={clsx(
              "group flex flex-wrap gap-x-3 gap-y-2 py-3 transition-colors compact:py-2 @2xl:flex-nowrap",
              dense ? "items-center" : "items-start",
              isSelected && "bg-accent/[0.04]",
            )}
          >
            {onToggle && (
              <Checkbox
                checked={isSelected}
                onChange={(checked) => onToggle(alert.id, checked)}
                label={`Select alert: ${alert.message}`}
                className={dense ? "" : "mt-0.5"}
              />
            )}
            <SeverityIcon alert={alert} className={dense ? "" : "mt-0.5"} />
            <div className={clsx("min-w-0 flex-1 @2xl:basis-0", onToggle ? "basis-[calc(100%-4rem)]" : "basis-[calc(100%-2.5rem)]", resolved && "opacity-60")}>
              <p className={clsx("text-[13.5px] font-medium text-ink", dense && "truncate")} title={alert.message}>
                {alert.message}
              </p>
              <p className={clsx("mt-0.5 text-[12.5px] text-muted", dense && "truncate")}>
                {showAstronaut &&
                  (onSelectAstronaut ? (
                    <button onClick={() => onSelectAstronaut(alert.astronautId)} className="font-medium text-ink hover:underline">
                      {alert.astronautName}
                    </button>
                  ) : (
                    <Link href={`/crew/${alert.astronautId}`} className="font-medium text-ink hover:underline">
                      {alert.astronautName}
                    </Link>
                  ))}
                {showAstronaut && <span className="text-faint"> · </span>}
                {METRIC_LABELS[alert.metric]}
                <span className="text-faint"> · </span>
                <time dateTime={alert.raisedAtUtc} title={new Date(alert.raisedAtUtc).toLocaleString()}>
                  {timeAgo(alert.raisedAtUtc)}
                </time>
                {!dense && alert.resolutionNote && <span className="text-faint"> · “{alert.resolutionNote}”</span>}
              </p>
            </div>
            <div
              className={clsx(
                "flex max-w-full min-w-0 items-center gap-2 @2xl:ml-0 @2xl:w-auto @2xl:shrink-0 @2xl:justify-end",
                onToggle ? "ml-[3.25rem]" : "ml-7",
                !dense && "flex-wrap",
              )}
            >
              {escalated && <EscalationBadge level={alert.escalationLevel} />}
              {!compact && <AlertStatusBadge status={alert.status} />}
              {!resolved && <OnboardActionsButton playbookKey={alert.metric} subject={`${alert.astronautName}: ${alert.message}`} />}
              <AlertActions alert={alert} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
