"use client";

import clsx from "clsx";
import { Activity, BellPlus, CheckCheck, Siren, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { TelemetryEvent } from "@/lib/realtime/store";

export const EVENT_META: Record<TelemetryEvent["kind"], { label: string; icon: LucideIcon; className: string }> = {
  reading: { label: "Telemetry", icon: Activity, className: "text-faint" },
  "alert-raised": { label: "Alert", icon: BellPlus, className: "text-critical" },
  "alert-updated": { label: "Alert update", icon: CheckCheck, className: "text-accent" },
  "alert-escalated": { label: "Escalation", icon: Siren, className: "text-critical" },
};

/** One-line human summary of an event, shared by the feed, the log table and CSV export. */
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
      return `Escalated to L${event.alert.escalationLevel}, unacknowledged: ${event.alert.message}`;
  }
}

export const formatClock = (at: number) =>
  new Date(at).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Compact streaming feed for dashboards. */
export function EventFeed({
  events,
  limit = 8,
  onSelectAstronaut,
}: {
  events: TelemetryEvent[];
  limit?: number;
  onSelectAstronaut?: (id: string) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="grid h-full min-h-32 place-items-center text-center text-[13px] text-muted">
        <span className="flex items-center gap-2">
          <span className="size-1.5 animate-blink rounded-full bg-faint" aria-hidden />
          Listening for telemetry…
        </span>
      </div>
    );
  }

  return (
    <ol className="space-y-px" aria-live="polite" aria-relevant="additions">
      {events.slice(0, limit).map((event) => {
        const meta = EVENT_META[event.kind];
        const isAlert = event.kind !== "reading";
        const name = onSelectAstronaut ? (
          <button onClick={() => onSelectAstronaut(event.astronautId)} className="font-medium text-ink hover:underline">
            {event.astronautName}
          </button>
        ) : (
          <Link href={`/crew/${event.astronautId}`} className="font-medium text-ink hover:underline">
            {event.astronautName}
          </Link>
        );
        return (
          <li key={event.id} className="flex animate-fade-up items-center gap-3 py-1.5">
            <time className="tnum w-14 shrink-0 font-mono text-[11.5px] text-faint">{formatClock(event.at)}</time>
            <meta.icon aria-hidden className={clsx("size-3.5 shrink-0", meta.className)} />
            <p className="min-w-0 flex-1 truncate text-[13px]">
              {name}
              <span className={clsx(isAlert ? "text-ink" : "text-muted")}> {describeEvent(event)}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
