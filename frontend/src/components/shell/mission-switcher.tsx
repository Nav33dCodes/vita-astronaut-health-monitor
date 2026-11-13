"use client";

import clsx from "clsx";
import { Check, ChevronsUpDown, Layers } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { MenuLabel, MenuSeparator, Popover } from "@/components/ui/popover";
import { useMissions } from "@/lib/api/queries";
import type { Mission, MissionStatus } from "@/lib/api/types";
import { DESTINATION_LABELS } from "@/lib/format";
import { useHydrated } from "@/lib/hooks";
import { setMissionScope, useMissionScope } from "@/lib/mission-scope";
import { formatMet, useNow } from "@/lib/time";

const STATUS_DOT: Record<MissionStatus, string> = {
  Active: "bg-nominal",
  Planned: "bg-faint",
  Completed: "bg-line-strong",
  Aborted: "bg-critical",
};

const ORDER: Record<MissionStatus, number> = { Active: 0, Planned: 1, Completed: 2, Aborted: 3 };

/**
 * Mission context for the whole app. Shows the focused mission with its elapsed-time clock;
 * the menu switches focus or returns to all missions.
 */
export function MissionSwitcher() {
  const missions = useMissions();
  const scope = useMissionScope();
  const hydrated = useHydrated();

  const sorted = [...(missions.data ?? [])].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.launchDate.localeCompare(b.launchDate));
  const selected = hydrated ? sorted.find((m) => m.id === scope) : undefined;
  const active = sorted.filter((m) => m.status === "Active");

  return (
    <div className="px-3 pb-2 collapsed:px-2">
      <Popover
        align="start"
        width="15.5rem"
        trigger={({ toggle, open, ...aria }) => (
          <button
            onClick={toggle}
            aria-haspopup="listbox"
            {...aria}
            title={selected ? `Focused on ${selected.name}` : "All missions"}
            className={clsx(
              "group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors collapsed:justify-center collapsed:px-0",
              open ? "border-line-strong bg-canvas" : "border-line bg-canvas hover:border-line-strong",
            )}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-panel ring-1 ring-line ring-inset">
              {selected ? (
                <span className={clsx("size-2 rounded-full", STATUS_DOT[selected.status])} aria-hidden />
              ) : (
                <Layers className="size-3.5 text-muted" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1 collapsed:hidden">
              <span className="block truncate text-[12.5px] leading-tight font-medium text-ink">{selected?.name ?? "All missions"}</span>
              <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-muted">
                {selected ? <MissionMeta mission={selected} /> : `${active.length} in flight · ${sorted.length} total`}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-faint transition-colors group-hover:text-muted collapsed:hidden" aria-hidden />
          </button>
        )}
      >
        {(close) => (
          <div role="listbox" aria-label="Mission focus">
            <MenuLabel>Focus</MenuLabel>
            <Option
              selected={!selected}
              onSelect={() => {
                setMissionScope(null);
                close();
              }}
              icon={<Layers className="size-3.5 text-muted" aria-hidden />}
              title="All missions"
              subtitle={`${active.length} in flight`}
            />
            {sorted.length > 0 && <MenuSeparator />}
            {sorted.map((m) => (
              <Option
                key={m.id}
                selected={selected?.id === m.id}
                onSelect={() => {
                  setMissionScope(m.id);
                  close();
                }}
                icon={<span className={clsx("size-2 rounded-full", STATUS_DOT[m.status])} aria-hidden />}
                title={m.name}
                subtitle={`${DESTINATION_LABELS[m.destination]} · ${m.status === "Active" ? "in flight" : m.status.toLowerCase()} · ${m.crewCount} crew`}
              />
            ))}
            <MenuSeparator />
            <Link
              href="/missions"
              onClick={close}
              className="block rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-muted transition-colors hover:bg-overlay/[0.05] hover:text-ink"
            >
              Manage missions →
            </Link>
          </div>
        )}
      </Popover>
    </div>
  );
}

/** Ticks every second, isolated so only this line re-renders. */
function MissionMeta({ mission }: { mission: Mission }) {
  const now = useNow();
  if (mission.status !== "Active") return <>{DESTINATION_LABELS[mission.destination]} · {mission.status.toLowerCase()}</>;
  return <span className="tnum font-mono">{now ? formatMet(mission.launchDate, now) : "T+ --d --:--:--"}</span>;
}

function Option({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-overlay/[0.05]"
    >
      <span className="grid size-6 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{title}</span>
        <span className="block truncate text-[11.5px] text-muted">{subtitle}</span>
      </span>
      {selected && <Check className="size-4 shrink-0 text-accent" aria-hidden />}
    </button>
  );
}
