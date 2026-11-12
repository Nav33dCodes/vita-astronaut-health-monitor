"use client";

import { Command } from "cmdk";
import { CornerDownLeft, FileSpreadsheet, FileText, Keyboard, Monitor, Moon, PanelLeft, Rows3, Search, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { CrewAvatar } from "@/components/ui/avatar";
import { HealthBadge } from "@/components/ui/badges";
import { Kbd } from "@/components/ui/primitives";
import { useAstronauts } from "@/lib/api/queries";
import { humanize } from "@/lib/format";
import { NAV_ITEMS } from "@/lib/navigation";
import { setDensity, toggleSidebar, useDensity } from "@/lib/preferences";
import { runReportJob } from "@/lib/report-jobs";
import { reports } from "@/lib/reports";
import { setThemePreference, useTheme } from "@/lib/theme";

const ITEM =
  "flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-[13.5px] text-ink data-[selected=true]:bg-overlay/[0.06] [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted";
const GROUP = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-faint";

export function CommandPalette({
  open,
  onOpenChange,
  onShowShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts: () => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const crew = useAstronauts({ pageSize: 100 });
  const { resolved } = useTheme();
  const density = useDensity();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <dialog
      ref={dialog}
      onClose={() => onOpenChange(false)}
      onClick={(e) => e.target === dialog.current && onOpenChange(false)}
      aria-label="Command palette"
      className="surface-pop mx-auto mt-[12vh] w-[min(38rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl p-0 text-ink open:animate-pop-in"
    >
      {open && (
        <Command label="Command palette" loop>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-4 shrink-0 text-faint" aria-hidden />
            <Command.Input
              autoFocus
              placeholder="Search crew, pages and actions…"
              className="h-12 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
            />
            <Kbd>Esc</Kbd>
          </div>
          <Command.List className="max-h-[min(26rem,60vh)] overflow-y-auto p-1.5">
            <Command.Empty className="py-12 text-center text-[13px] text-muted">No results found.</Command.Empty>

            {crew.data && crew.data.items.length > 0 && (
              <Command.Group heading="Crew" className={GROUP}>
                {crew.data.items.map((a) => (
                  <Command.Item
                    key={a.id}
                    value={`crew ${a.firstName} ${a.lastName} ${a.agency} ${a.missionName ?? ""}`}
                    onSelect={() => run(() => router.push(`/crew/${a.id}`))}
                    className={ITEM}
                  >
                    <CrewAvatar firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} size="sm" />
                    <span className="min-w-0 flex-1 truncate">
                      {a.firstName} {a.lastName}
                      <span className="ml-2 text-[12.5px] text-muted">
                        {humanize(a.role)} · {a.missionName ?? "Unassigned"}
                      </span>
                    </span>
                    <HealthBadge status={a.healthStatus} />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Go to" className={GROUP}>
              {NAV_ITEMS.map(({ href, label, icon: Icon, key }) => (
                <Command.Item key={href} value={`page ${label}`} onSelect={() => run(() => router.push(href))} className={ITEM}>
                  <Icon aria-hidden />
                  <span className="flex-1">{label}</span>
                  <Shortcut keys={["G", key.toUpperCase()]} />
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Actions" className={GROUP}>
              <Action icon={<FileText />} label="Export fleet health report (PDF)" onSelect={() => run(() => void runReportJob(reports.fleetPdf()))} />
              <Action icon={<FileSpreadsheet />} label="Export crew roster (Excel)" onSelect={() => run(() => void runReportJob(reports.crewExcel()))} />
              <Action
                icon={resolved === "dark" ? <Sun /> : <Moon />}
                label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                onSelect={() => run(() => setThemePreference(resolved === "dark" ? "light" : "dark"))}
              />
              <Action icon={<Monitor />} label="Use system theme" onSelect={() => run(() => setThemePreference("system"))} />
              <Action
                icon={<Rows3 />}
                label={density === "compact" ? "Use comfortable tables" : "Use compact tables"}
                onSelect={() => run(() => setDensity(density === "compact" ? "comfortable" : "compact"))}
              />
              <Action icon={<PanelLeft />} label="Toggle sidebar" keys={["["]} onSelect={() => run(toggleSidebar)} />
              <Action icon={<Keyboard />} label="Keyboard shortcuts" keys={["?"]} onSelect={() => run(onShowShortcuts)} />
            </Command.Group>
          </Command.List>
          <div className="flex items-center gap-4 border-t border-line bg-canvas px-4 py-2 text-[11.5px] text-faint">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>
                <CornerDownLeft className="size-3" />
              </Kbd>
              select
            </span>
          </div>
        </Command>
      )}
    </dialog>
  );
}

function Action({ icon, label, keys, onSelect }: { icon: ReactNode; label: string; keys?: string[]; onSelect: () => void }) {
  return (
    <Command.Item value={`action ${label}`} onSelect={onSelect} className={ITEM}>
      {icon}
      <span className="flex-1">{label}</span>
      {keys && <Shortcut keys={keys} />}
    </Command.Item>
  );
}

function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className="flex gap-0.5">
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  );
}
