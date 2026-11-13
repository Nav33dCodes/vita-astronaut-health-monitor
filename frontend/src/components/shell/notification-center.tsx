"use client";

import clsx from "clsx";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Popover } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/primitives";
import { useHydrated } from "@/lib/hooks";
import { markAllRead, markRead, useInbox, useNotificationMode, useUnread, type InboxItem } from "@/lib/notify";

const DOT: Record<InboxItem["severity"], string> = {
  critical: "bg-critical",
  warning: "bg-caution",
  info: "bg-accent",
};

function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** Bell with an unread count; opens the quiet inbox where every operational event lands. */
export function NotificationCenter() {
  const hydrated = useHydrated();
  const unread = useUnread();
  const mode = useNotificationMode();
  const count = hydrated ? unread.count : 0;

  return (
    <Popover
      width="23rem"
      className="!p-0"
      trigger={({ toggle, open, ...aria }) => (
        <button
          onClick={toggle}
          aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
          title="Notifications"
          {...aria}
          className={clsx(
            "relative grid size-8 place-items-center rounded-lg transition-colors",
            open ? "bg-overlay/[0.06] text-ink" : "text-muted hover:bg-overlay/[0.06] hover:text-ink",
          )}
        >
          {hydrated && mode === "mute" ? <BellOff className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
          {count > 0 && (
            <span
              className={clsx(
                "tnum absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold text-white ring-2 ring-canvas",
                unread.critical ? "bg-critical-solid" : "bg-accent",
              )}
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      )}
    >
      {(close) => <Inbox onNavigate={close} />}
    </Popover>
  );
}

function Inbox({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter();
  const items = useInbox();
  const mode = useNotificationMode();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  // Captured once per open so relative times don't churn while reading.
  const [now] = useState(() => Date.now());

  const groups = useMemo(() => {
    const visible = filter === "unread" ? items.filter((i) => !i.read) : items;
    const startOfDay = new Date(now).setHours(0, 0, 0, 0);
    return [
      { label: "Today", items: visible.filter((i) => i.at >= startOfDay) },
      { label: "Earlier", items: visible.filter((i) => i.at < startOfDay) },
    ].filter((g) => g.items.length > 0);
  }, [items, filter, now]);

  const hasUnread = items.some((i) => !i.read);

  return (
    <div className="flex max-h-[min(32rem,70vh)] flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <p className="text-[13.5px] font-semibold text-ink">Notifications</p>
        <div className="flex items-center gap-1.5">
          <Segmented
            size="sm"
            label="Filter notifications"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "unread", label: "Unread" },
            ]}
          />
          <button
            onClick={markAllRead}
            disabled={!hasUnread}
            title="Mark all as read"
            aria-label="Mark all as read"
            className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-overlay/[0.06] hover:text-ink disabled:opacity-35"
          >
            <CheckCheck className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {groups.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-ink">{filter === "unread" ? "You're all caught up" : "No notifications yet"}</p>
            <p className="mt-1 text-[12.5px] text-muted">Alerts and cabin changes will appear here.</p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.label}>
              <p className="sticky top-0 bg-panel px-3.5 pt-2.5 pb-1 text-[11.5px] font-medium text-faint">{group.label}</p>
              <ul className="px-1.5 pb-1.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        markRead(item.id);
                        if (item.href) {
                          onNavigate();
                          router.push(item.href);
                        }
                      }}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-overlay/[0.05]"
                    >
                      <span className={clsx("mt-1.5 size-1.5 shrink-0 rounded-full", DOT[item.severity])} aria-label={item.severity} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={clsx("truncate text-[13px]", item.read ? "text-muted" : "font-medium text-ink")}>{item.title}</span>
                          <span className="tnum shrink-0 text-[11.5px] text-faint">{ago(item.at, now)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-muted">{item.body}</span>
                      </span>
                      {!item.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line bg-canvas px-3.5 py-2 text-[12px]">
        <span className="text-faint">
          Pop-ups: {mode === "critical" ? "critical only" : mode === "all" ? "all alerts" : "muted"}
        </span>
        <Link href="/alerts" onClick={onNavigate} className="font-medium text-muted transition-colors hover:text-ink">
          Alert console →
        </Link>
      </div>
    </div>
  );
}
