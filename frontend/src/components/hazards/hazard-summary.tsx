"use client";

import clsx from "clsx";
import Link from "next/link";
import { HEALTH_LABEL, HEALTH_TEXT, StatusDot } from "@/components/ui/badges";
import type { HazardSummary } from "@/lib/api/types";
import { HAZARDS, HAZARD_META } from "@/lib/hazards";

/** One tile per NASA hazard with the fleet's worst status and how many crew are affected. */
export function HazardSummaryRow({ summary }: { summary: HazardSummary[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
      {HAZARDS.map((hazard) => {
        const s = summary.find((x) => x.hazard === hazard);
        const meta = HAZARD_META[hazard];
        const affected = (s?.critical ?? 0) + (s?.caution ?? 0);
        const status = s?.worst ?? "Unknown";
        return (
          <Link
            key={hazard}
            href="/hazards"
            className="group flex flex-col gap-2 bg-panel p-4 transition-colors last:col-span-2 hover:bg-[color-mix(in_srgb,var(--color-panel)_96%,var(--color-overlay))] sm:last:col-span-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-muted">
                <meta.icon className="size-4 shrink-0 text-faint" aria-hidden />
                <span className="truncate">{meta.short}</span>
              </span>
              <StatusDot status={status} />
            </div>
            <p className={clsx("text-[15px] font-semibold tracking-tight", status === "Nominal" || status === "Unknown" ? "text-ink" : HEALTH_TEXT[status])}>
              {HEALTH_LABEL[status]}
            </p>
            <p className="text-[12px] text-muted">
              {status === "Unknown" ? "Awaiting data" : affected === 0 ? "All crew within limits" : `${affected} crew affected`}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
