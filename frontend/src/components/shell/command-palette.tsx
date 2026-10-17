"use client";

import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { HealthBadge } from "@/components/ui/badges";
import { useAstronauts } from "@/lib/api/queries";
import { humanize } from "@/lib/format";
import { NAV_SECTIONS } from "@/lib/navigation";

const PAGES = NAV_SECTIONS.flatMap((section) => section.items);

const ITEM =
  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted data-[selected=true]:bg-accent/10 data-[selected=true]:text-ink";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const crew = useAstronauts({ pageSize: 100 });

  // Global Ctrl/Cmd + K shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <dialog
      ref={dialog}
      onClose={() => onOpenChange(false)}
      onClick={(e) => e.target === dialog.current && onOpenChange(false)}
      aria-label="Command palette"
      className="glass glass-blur hud-frame mx-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] rounded-2xl p-0 text-ink backdrop:bg-scrim backdrop:backdrop-blur-sm"
    >
      {open && (
        <Command label="Command palette" loop>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-4 text-muted" aria-hidden />
            <Command.Input
              autoFocus
              placeholder="Jump to an astronaut or page…"
              className="h-14 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
            />
            <kbd className="rounded-md border border-line px-1.5 font-mono text-[10px] text-muted">Esc</kbd>
          </div>
          <Command.List className="max-h-[50vh] overflow-y-auto p-2">
            <Command.Empty className="py-10 text-center text-sm text-muted">No results.</Command.Empty>
            <Command.Group heading="Navigate" className="[&_[cmdk-group-heading]]:hud-label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
              {PAGES.map(({ href, label, icon: Icon }) => (
                <Command.Item key={href} value={`page ${label}`} onSelect={() => go(href)} className={ITEM}>
                  <Icon className="size-4" aria-hidden /> {label}
                </Command.Item>
              ))}
            </Command.Group>
            {crew.data && (
              <Command.Group heading="Crew" className="[&_[cmdk-group-heading]]:hud-label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
                {crew.data.items.map((a) => (
                  <Command.Item
                    key={a.id}
                    value={`${a.firstName} ${a.lastName} ${a.agency} ${a.missionName ?? ""}`}
                    onSelect={() => go(`/crew/${a.id}`)}
                    className={ITEM}
                  >
                    <span className="flex-1 text-ink">
                      {a.firstName} {a.lastName}
                      <span className="ml-2 text-xs text-muted">
                        {humanize(a.role)} · {a.missionName ?? "Unassigned"}
                      </span>
                    </span>
                    <HealthBadge status={a.healthStatus} />
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      )}
    </dialog>
  );
}
