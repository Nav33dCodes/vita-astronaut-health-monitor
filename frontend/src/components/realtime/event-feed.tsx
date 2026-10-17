"use client";

import clsx from "clsx";
import { Activity, BellPlus, CheckCheck, Siren, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { TelemetryEvent } from "@/lib/realtime/store";

export const EVENT_META: Record<TelemetryEvent["kind"], { label: string; icon: LucideIcon; className: string }> = {
  reading: { label: "Telemetry", icon: Activity, className: "text-accent" },
  "alert-raised": { label: "Alert", icon: BellPlus, className: "text-critical" },
  "alert-updated": { label: "Alert update", icon: CheckCheck, className: "text-violet" },
  "alert-escalated": { label: "Escalation", icon: Siren, className: "text-critical" },
};

/** One-line human summary of an event — shared by the feed, the log table and CSV export. */
export function describeEvent(event: TelemetryEvent): string {
  switch (event.kind) {
    case "reading": {
      const r = event.reading;
      return `HR ${r.heartRateBpm} · SpO₂ ${r.oxygenSaturationPct}% · BP ${r.systolicMmHg}/${r.diastolicMmHg} · ${r.bodyTemperatureC}°C · RR ${r.respiratoryRatePerMin}`;
    }
    case "alert-raised":
      return `${event.alert.severity}: ${event.alert.message}`;
    case "alert-updated":
      return `${event.alert.status}: ${event.alert.message}`;
    case "alert-escalated":
      return `Escalated to L${event.alert.escalationLevel} — unacknowledged: ${event.alert.message}`;
  }
}

export const formatClock = (at: number) =>
  new Date(at).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Compact streaming feed for dashboards. */
export function EventFeed({ events, limit = 8 }: { events: TelemetryEvent[]; limit?: number }) {
  if (events.length === 0) {
    return (
      <p className="py-8 text-center font-mono text-[11px] text-faint">Listening for telemetry on the uplink…</p>
    );
  }

  return (
    <ol className="space-y-1" aria-live="polite" aria-relevant="additions">
      {events.slice(0, limit).map((event) => {
        const meta = EVENT_META[event.kind];
        const isAlert = event.kind === "alert-raised" || event.kind === "alert-escalated";
        return (
          <li
            key={event.id}
            className={clsx(
              "flex animate-fade-up items-start gap-2.5 rounded-lg px-2 py-1.5",
              isAlert && "bg-critical/[0.06]",
            )}
          >
            <meta.icon aria-hidden className={clsx("mt-0.5 size-3.5 shrink-0", meta.className)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-ink">
                <Link href={`/crew/${event.astronautId}`} className="font-medium hover:text-accent">
                  {event.astronautName}
                </Link>
                <span className="text-muted"> — {describeEvent(event)}</span>
              </p>
            </div>
            <time className="shrink-0 font-mono text-[10px] text-faint">{formatClock(event.at)}</time>
          </li>
        );
      })}
    </ol>
  );
}
