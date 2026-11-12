"use client";

import clsx from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type MouseEvent } from "react";
import { Kbd } from "@/components/ui/primitives";
import { useDashboard, useMissions } from "@/lib/api/queries";
import { useHydrated } from "@/lib/hooks";
import { NAV_SECTIONS, isActivePath, type NavItem } from "@/lib/navigation";
import { toggleSidebar, useSidebarCollapsed } from "@/lib/preferences";
import { prefetchRoute } from "@/lib/prefetch";
import { useEventRate } from "@/lib/realtime/hooks";
import { useLinkStatus } from "@/lib/realtime/store";
import { formatMet, useNow } from "@/lib/time";
import { Wordmark } from "./wordmark";

/** Desktop sidebar: wordmark, active mission, navigation, uplink. Collapses to an icon rail. */
export function Sidebar() {
  const collapsed = useSidebarCollapsed();

  return (
    <aside
      aria-label="Sidebar"
      className="sticky top-0 z-30 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-panel transition-[width] duration-200 ease-out lg:flex collapsed:w-[60px]"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-5 collapsed:justify-center collapsed:px-0">
        <Link href="/" aria-label="VITA overview" className="rounded-md">
          <Wordmark />
        </Link>
        <button
          onClick={toggleSidebar}
          aria-label="Collapse sidebar"
          title="Collapse sidebar  [ "
          className="grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-overlay/[0.06] hover:text-ink collapsed:hidden"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <MissionCard />

      <Suspense fallback={<NavList pathname={null} />}>
        <ActiveNav />
      </Suspense>

      <div className="mt-auto space-y-1 p-3 collapsed:px-2">
        <UplinkLine />
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden h-8 w-full place-items-center rounded-md text-faint transition-colors hover:bg-overlay/[0.06] hover:text-ink collapsed:grid"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      </div>
    </aside>
  );
}

function ActiveNav() {
  return <NavList pathname={usePathname()} />;
}

/** Navigation list, shared by the desktop sidebar and the mobile drawer. */
export function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  const client = useQueryClient();
  const { data } = useDashboard();

  // Optimistic highlight: the clicked item lights up immediately instead of waiting for the next
  // route to render. It only applies while we are still on the page the click came from.
  const [pending, setPending] = useState<{ href: string; from: string | null } | null>(null);
  const navigating = pending !== null && pending.from === pathname;
  const current = navigating ? pending.href : pathname;

  // The nav hydrates late (inside Suspense); data fetched meanwhile must not change its first render.
  const hydrated = useHydrated();
  const openAlerts = hydrated ? (data?.openAlerts ?? 0) : 0;
  const critical = hydrated && (data?.openCriticalAlerts ?? 0) > 0;

  return (
    <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-2 collapsed:overflow-visible collapsed:px-2">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1 px-2.5 text-[11.5px] font-medium text-faint collapsed:invisible collapsed:h-0 collapsed:mb-0">
            {section.title}
          </p>
          <ul className="space-y-px">
            {section.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={isActivePath(item.href, current)}
                  loading={navigating && pending.href === item.href}
                  count={item.badge === "alerts" ? openAlerts : 0}
                  critical={critical}
                  onPrefetch={() => prefetchRoute(client, item.href)}
                  onClick={(e) => {
                    onNavigate?.();
                    // Let modified clicks (new tab/window) behave natively.
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    if (!isActivePath(item.href, pathname)) setPending({ href: item.href, from: pathname });
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavLink({
  item: { href, label, icon: Icon, key },
  active,
  loading,
  count,
  critical,
  onPrefetch,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  loading: boolean;
  count: number;
  critical: boolean;
  onPrefetch: () => void;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      onClick={onClick}
      className={clsx(
        "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors duration-150 collapsed:justify-center collapsed:px-0",
        active ? "bg-overlay/[0.06] font-medium text-ink" : "text-muted hover:bg-overlay/[0.04] hover:text-ink",
      )}
    >
      <span className="relative">
        <Icon className={clsx("size-4 shrink-0", active ? "text-ink" : "text-faint group-hover:text-muted")} aria-hidden strokeWidth={active ? 2.1 : 1.8} />
        {count > 0 && (
          <span
            aria-hidden
            className={clsx(
              "absolute -top-1 -right-1 hidden size-2 rounded-full ring-2 ring-panel collapsed:block",
              critical ? "bg-critical" : "bg-caution",
            )}
          />
        )}
      </span>
      <span className="truncate collapsed:hidden">{label}</span>
      {loading ? (
        <Loader2 className="ml-auto size-3.5 animate-spin text-faint collapsed:hidden" aria-label="Loading" />
      ) : count > 0 ? (
        <span
          className={clsx(
            "tnum ml-auto rounded-full px-1.5 text-[11px] leading-[18px] font-semibold collapsed:hidden",
            critical ? "bg-critical-solid text-white" : "bg-panel-raised text-muted ring-1 ring-line ring-inset",
          )}
        >
          {count}
        </span>
      ) : (
        <span className="ml-auto hidden items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 lg:flex collapsed:!hidden">
          <Kbd className="!h-[18px] !min-w-[18px] !text-[10px]">G</Kbd>
          <Kbd className="!h-[18px] !min-w-[18px] !text-[10px] uppercase">{key}</Kbd>
        </span>
      )}

      {/* Tooltip in the collapsed rail. */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full z-50 ml-3 hidden rounded-md bg-ink px-2 py-1 text-xs font-medium whitespace-nowrap text-canvas opacity-0 shadow-[var(--shadow-pop)] transition-opacity group-hover:opacity-100 collapsed:block"
      >
        {label}
        {count > 0 && ` · ${count}`}
      </span>
    </Link>
  );
}

/** The longest-running active mission with its live elapsed-time clock. */
function MissionCard() {
  const missions = useMissions();
  const now = useNow();
  const active = missions.data?.filter((m) => m.status === "Active").sort((a, b) => a.launchDate.localeCompare(b.launchDate)) ?? [];
  const primary = active[0];
  if (!primary) return <div className="h-2" />;

  return (
    <Link
      href="/missions"
      className="mx-3 mb-3 block rounded-lg border border-line bg-canvas px-3 py-2.5 transition-colors hover:border-line-strong collapsed:hidden"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12.5px] font-medium text-ink">{primary.name}</span>
        {active.length > 1 && <span className="text-[11px] text-faint">+{active.length - 1}</span>}
      </div>
      <p className="tnum mt-0.5 font-mono text-[11.5px] text-muted">{now ? formatMet(primary.launchDate, now) : "T+ --d --:--:--"}</p>
    </Link>
  );
}

const LINK_TEXT = {
  connected: "Live",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  disconnected: "Offline · polling",
} as const;

function UplinkLine() {
  const link = useLinkStatus();
  const rate = useEventRate();
  const tone = link.state === "connected" ? "bg-nominal" : link.state === "disconnected" ? "bg-critical" : "bg-caution";

  return (
    <Link
      href="/system"
      title="Real-time uplink"
      className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[12px] text-muted transition-colors hover:bg-overlay/[0.04] hover:text-ink collapsed:justify-center collapsed:px-0"
    >
      <span aria-hidden className={clsx("size-1.5 shrink-0 rounded-full", tone, link.state !== "connected" && "animate-blink")} />
      <span className="truncate collapsed:hidden">{LINK_TEXT[link.state]}</span>
      <span className="tnum ml-auto text-faint collapsed:hidden">
        {link.state === "connected" ? `${rate}/min${link.latencyMs !== null ? ` · ${link.latencyMs}ms` : ""}` : ""}
      </span>
    </Link>
  );
}
