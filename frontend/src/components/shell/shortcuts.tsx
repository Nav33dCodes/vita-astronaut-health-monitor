"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/primitives";
import { NAV_ITEMS } from "@/lib/navigation";
import { toggleSidebar } from "@/lib/preferences";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.closest("dialog[open]") !== null);

/**
 * Linear-style keyboard navigation:
 *   Ctrl/⌘ K or /  command palette     G then O/M/A/…  go to page
 *   [              toggle sidebar      ?               shortcut help
 */
export function useGlobalShortcuts({ onPalette, onHelp }: { onPalette: () => void; onHelp: () => void }) {
  const router = useRouter();
  const leader = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onPalette();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;

      const key = e.key.toLowerCase();
      if (leader.current !== null) {
        window.clearTimeout(leader.current);
        leader.current = null;
        const item = NAV_ITEMS.find((i) => i.key === key);
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (key === "g") {
        leader.current = window.setTimeout(() => (leader.current = null), 1200);
      } else if (key === "/") {
        e.preventDefault();
        onPalette();
      } else if (key === "[") {
        toggleSidebar();
      } else if (e.key === "?") {
        onHelp();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, onPalette, onHelp]);
}

const GENERAL: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "K"], label: "Search and commands" },
  { keys: ["/"], label: "Search and commands" },
  { keys: ["["], label: "Collapse or expand sidebar" },
  { keys: ["?"], label: "Show keyboard shortcuts" },
  { keys: ["Esc"], label: "Close panel or dialog" },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" description="Move around VITA without touching the mouse.">
      <div className="grid gap-6 sm:grid-cols-2">
        <Group title="Go to">
          {NAV_ITEMS.map((item) => (
            <Row key={item.href} keys={["G", item.key.toUpperCase()]} label={item.label} />
          ))}
        </Group>
        <Group title="General">
          {GENERAL.map((s) => (
            <Row key={s.keys.join("+") + s.label} keys={s.keys} label={s.label} />
          ))}
        </Group>
      </div>
    </Dialog>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[12px] font-medium text-faint">{title}</h3>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <dt className="text-ink">{label}</dt>
      <dd className="flex shrink-0 gap-1">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </dd>
    </div>
  );
}
