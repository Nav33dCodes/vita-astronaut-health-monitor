import clsx from "clsx";
import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import Link from "next/link";
import { AlertStatusBadge } from "@/components/ui/badges";
import { EscalationBadge } from "@/components/ui/ews";
import type { Alert } from "@/lib/api/types";
import { METRIC_LABELS, timeAgo } from "@/lib/format";
import { AlertActions } from "./alert-actions";

/** Timeline-style alert feed. */
export function AlertList({
  alerts,
  showAstronaut = true,
  compact = false,
  dense = false,
}: {
  alerts: Alert[];
  showAstronaut?: boolean;
  compact?: boolean;
  /** Single-line rows with tighter spacing — for fixed-height dashboard cards. */
  dense?: boolean;
}) {
  return (
    <ol className={dense ? "space-y-1.5" : "space-y-2"}>
      {alerts.map((alert) => {
        const critical = alert.severity === "Critical";
        const resolved = alert.status === "Resolved";
        const Icon = resolved ? CheckCircle2 : critical ? OctagonAlert : AlertTriangle;

        return (
          <li
            key={alert.id}
            className={clsx(
              "group relative flex items-start gap-3 overflow-hidden rounded-xl border border-line bg-overlay/[0.015] pr-3 pl-4 transition hover:bg-overlay/[0.03]",
              dense ? "items-center py-2" : "flex-wrap py-3",
              resolved && "opacity-55",
              critical && !resolved && "border-critical/25",
              alert.escalationLevel > 0 && alert.status === "Open" && "glow-critical",
            )}
          >
            <span
              aria-hidden
              className={clsx(
                "absolute inset-y-0 left-0 w-[3px]",
                resolved ? "bg-faint" : critical ? "bg-critical shadow-[0_0_12px_var(--color-critical)]" : "bg-caution",
              )}
            />
            <Icon
              aria-hidden
              className={clsx(
                "size-4 shrink-0",
                !dense && "mt-0.5",
                resolved ? "text-faint" : critical ? "animate-blink text-critical" : "text-caution",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className={clsx("font-medium text-ink", dense ? "truncate text-[13px]" : "text-sm")} title={alert.message}>
                {alert.message}
              </p>
              <p className={clsx("font-mono text-[11px] text-muted", dense ? "truncate" : "mt-1")}>
                {showAstronaut && (
                  <>
                    <Link href={`/crew/${alert.astronautId}`} className="text-accent hover:underline">
                      {alert.astronautName}
                    </Link>
                    {" · "}
                  </>
                )}
                {METRIC_LABELS[alert.metric]} · {timeAgo(alert.raisedAtUtc)}
                {!dense && alert.resolutionNote && <span className="text-faint"> · “{alert.resolutionNote}”</span>}
              </p>
            </div>
            <div className={clsx("flex shrink-0 items-center gap-2", !dense && "flex-wrap")}>
              {alert.status === "Open" && <EscalationBadge level={alert.escalationLevel} />}
              {!compact && <AlertStatusBadge status={alert.status} />}
              <AlertActions alert={alert} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
