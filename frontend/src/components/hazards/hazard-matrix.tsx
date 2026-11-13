"use client";

import clsx from "clsx";
import { CrewAvatar } from "@/components/ui/avatar";
import { HEALTH_LABEL, HEALTH_TEXT, StatusDot } from "@/components/ui/badges";
import type { CrewHazards, HazardStatus, SpaceHazard } from "@/lib/api/types";
import { humanize } from "@/lib/format";
import { HAZARDS, HAZARD_META } from "@/lib/hazards";

const CELL = "border-b border-line px-3 py-3 align-top compact:py-2 first:pl-5 last:pr-5 group-last:border-b-0";

/**
 * Crew × hazard matrix: one row per crew member, one column per NASA hazard. Each cell shows the
 * status and the one number that matters; selecting it opens the full assessment.
 */
export function HazardMatrix({
  crew,
  onSelect,
}: {
  crew: CrewHazards[];
  onSelect: (astronautId: string, hazard: SpaceHazard) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="text-left">
            <th className="sticky left-0 z-[1] h-9 border-y border-line bg-canvas px-3 pl-5 text-[12px] font-medium text-muted">Crew member</th>
            {HAZARDS.map((h) => {
              const meta = HAZARD_META[h];
              return (
                <th key={h} className="h-9 border-y border-line bg-canvas px-3 text-[12px] font-medium whitespace-nowrap text-muted last:pr-5">
                  <span className="inline-flex items-center gap-1.5">
                    <meta.icon className="size-3.5 text-faint" aria-hidden />
                    {meta.short}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {crew.map((c) => {
            const [first, ...rest] = c.name.split(" ");
            return (
              <tr key={c.astronautId} className="group">
                <td className={clsx(CELL, "sticky left-0 z-[1] bg-panel")}>
                  <div className="flex items-center gap-3">
                    <CrewAvatar firstName={first} lastName={rest.join(" ") || first} status={c.overall} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{c.name}</p>
                      <p className="truncate text-[12px] text-muted">{humanize(c.role)}</p>
                    </div>
                  </div>
                </td>
                {HAZARDS.map((h) => {
                  const hazard = c.hazards.find((x) => x.hazard === h);
                  return (
                    <td key={h} className={CELL}>
                      {hazard && <Cell hazard={hazard} onClick={() => onSelect(c.astronautId, h)} />}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ hazard, onClick }: { hazard: HazardStatus; onClick: () => void }) {
  const flagged = hazard.status === "Critical" || hazard.status === "Caution";
  return (
    <button
      onClick={onClick}
      title={hazard.detail ?? hazard.headline}
      className={clsx(
        "-m-1.5 flex w-[calc(100%+12px)] max-w-56 flex-col gap-0.5 rounded-md p-1.5 text-left transition-colors hover:bg-overlay/[0.04]",
        flagged && "bg-[color-mix(in_srgb,currentColor_6%,transparent)]",
        flagged && HEALTH_TEXT[hazard.status],
      )}
    >
      <span className={clsx("flex items-center gap-1.5 text-[12px] font-medium", flagged ? HEALTH_TEXT[hazard.status] : "text-muted")}>
        <StatusDot status={hazard.status} />
        {HEALTH_LABEL[hazard.status]}
      </span>
      <span className="line-clamp-2 text-[12px] leading-snug text-ink">{hazard.headline}</span>
    </button>
  );
}
