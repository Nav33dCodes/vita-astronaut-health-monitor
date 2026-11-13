"use client";

import clsx from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, memo, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { HEALTH_LABEL, HEALTH_TEXT } from "@/components/ui/badges";
import { Kbd } from "@/components/ui/primitives";
import { useAstronauts, useDashboard, useHazards } from "@/lib/api/queries";
import type { HealthStatus } from "@/lib/api/types";
import { useHydrated } from "@/lib/hooks";
import { useMissionScope } from "@/lib/mission-scope";
import { NAV_SECTIONS, isActivePath, type NavItem } from "@/lib/navigation";
import { toggleSidebar, useSidebarCollapsed } from "@/lib/preferences";
import { prefetchRoute } from "@/lib/prefetch";
import { useEventRate } from "@/lib/realtime/hooks";
import { useLinkStatus } from "@/lib/realtime/store";
import { MissionSwitcher } from "./mission-switcher";
import { Wordmark } from "./wordmark";

/**
 * Desktop sidebar: wordmark, mission focus, search, navigation, crew on watch, uplink.
 * Collapses to a 60px icon rail. Live parts (clock, rates) are isolated leaf components, so
 * the sidebar itself does not re-render on every telemetry packet.
 */
export function Sidebar({ onSearch }: { onSearch: () => void }) {
  return (
    <aside
      aria-label="Sidebar"
      className="sticky top-0 z-30 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-panel transition-[width] duration-200 ease-[var(--ease-out-quint)] lg:flex collapsed:w-[60px]"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-5 collapsed:justify-center collapsed:px-0">
        <Link href="/" aria-label="VITA overview" className="rounded-md">
          <Wordmark />
        </Link>
        <button
          onClick={toggleSidebar}
          aria-label="Collapse sidebar"
          title="Collapse sidebar ( [ )"
          className="grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-overlay/[0.06] hover:text-ink collapsed:hidden"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <MissionSwitcher />
      <SearchButton onSearch={onSearch} />

      <Suspense fallback={<NavList pathname={null} />}>
        <ActiveNav />
      </Suspense>

      <OnWatch />

      <div className="shrink-0 space-y-1 border-t border-line p-3 collapsed:px-2">
        <UplinkLine />
        <ExpandButton />
      </div>
    </aside>
  );
}

function SearchButton({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="px-3 pb-3 collapsed:px-2">
      <button
        onClick={onSearch}
        aria-label="Search or run a command"
        title="Search (Ctrl K)"
        className="group flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[13px] text-muted transition-colors hover:bg-overlay/[0.05] hover:text-ink collapsed:justify-center collapsed:px-0"
      >
        <Search className="size-4 shrink-0 text-faint group-hover:text-muted" aria-hidden />
        <span className="flex-1 text-left collapsed:hidden">Search</span>
        <span className="flex gap-0.5 collapsed:hidden">
          <Kbd className="!h-[18px] !text-[10px]">Ctrl</Kbd>
          <Kbd className="!h-[18px] !min-w-[18px] !text-[10px]">K</Kbd>
        </span>
      </button>
    </div>
  );
}

function ExpandButton() {
  const collapsed = useSidebarCollapsed();
  return (
    <button
      onClick={toggleSidebar}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title="Expand sidebar ( [ )"
      className="hidden h-8 w-full place-items-center rounded-md text-faint transition-colors hover:bg-overlay/[0.06] hover:text-ink collapsed:grid"
    >
      <PanelLeftOpen className="size-4" />
    </button>
  );
}

function ActiveNav() {
  return <NavList pathname={usePathname()} />;
}

const RANK: Record<HealthStatus, number> = { Unknown: 0, Nominal: 1, Caution: 2, Critical: 3 };

/** Navigation list, shared by the desktop sidebar and the mobile drawer. */
export function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  const client = useQueryClient();
  const { data } = useDashboard();
  const hazards = useHazards();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  // Optimistic highlight: the clicked item lights up immediately instead of waiting for the next
  // route to render. It only applies while we are still on the page the click came from.
  const [pending, setPending] = useState<{ href: string; from: string | null } | null>(null);
  const navigating = pending !== null && pending.from === pathname;
  const current = navigating ? pending.href : pathname;

  // The nav hydrates late (inside Suspense); data fetched meanwhile must not change its first render.
  const hydrated = useHydrated();
  const openAlerts = hydrated ? (data?.openAlerts ?? 0) : 0;
  const critical = hydrated && (data?.openCriticalAlerts ?? 0) > 0;
  const hazardWorst = hydrated
    ? (hazards.data?.summary.reduce<HealthStatus>((w, s) => (RANK[s.worst] > RANK[w] ? s.worst : w), "Unknown") ?? "Unknown")
    : "Unknown";

  // Sliding active indicator: positioned by writing styles directly (no React re-render), and
  // re-placed whenever the nav resizes (sidebar collapse, font load).
  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;

    const place = () => {
      const active = nav.querySelector<HTMLElement>('[data-nav-active="true"]');
      if (!active) {
        pill.style.opacity = "0";
        return;
      }
      pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.height = `${active.offsetHeight}px`;
      pill.style.opacity = "1";
    };

    place();
    // Animate moves only after the first placement, so the page doesn't load with a slide.
    const frame = requestAnimationFrame(() => (pill.dataset.ready = "true"));
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [current]);

  return (
    <nav ref={navRef} aria-label="Main" className="relative min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-1 collapsed:overflow-visible collapsed:px-2">
      <span
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 rounded-md bg-overlay/[0.06] opacity-0 data-[ready=true]:transition-[transform,width,height,opacity] data-[ready=true]:duration-200 data-[ready=true]:ease-[var(--ease-out-quint)]"
      />
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1 px-2.5 text-[11.5px] font-medium text-faint collapsed:invisible collapsed:mb-0 collapsed:h-0">{section.title}</p>
          <ul className="space-y-px">
            {section.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={isActivePath(item.href, current)}
                  loading={navigating && pending.href === item.href}
                  count={item.badge === "alerts" ? openAlerts : 0}
                  critical={critical}
                  status={item.href === "/hazards" ? hazardWorst : "Unknown"}
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

const NavLink = memo(function NavLink({
  item: { href, label, icon: Icon, key },
  active,
  loading,
  count,
  critical,
  status,
  onPrefetch,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  loading: boolean;
  count: number;
  critical: boolean;
  status: HealthStatus;
  onPrefetch: () => void;
  onClick: (e: MouseEvent) => void;
}) {
  const flagged = status === "Caution" || status === "Critical";
  return (
    <Link
      href={href}
      data-nav-active={active}
      aria-current={active ? "page" : undefined}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      onClick={onClick}
      className={clsx(
        "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors duration-150 collapsed:justify-center collapsed:px-0",
        active ? "font-medium text-ink" : "text-muted hover:bg-overlay/[0.035] hover:text-ink",
      )}
    >
      <span className="relative">
        <Icon
          className={clsx("size-4 shrink-0 transition-colors", active ? "text-ink" : "text-faint group-hover:text-muted")}
          aria-hidden
          strokeWidth={active ? 2.1 : 1.8}
        />
        {(count > 0 || flagged) && (
          <span
            aria-hidden
            className={clsx(
              "absolute -top-1 -right-1 hidden size-2 rounded-full ring-2 ring-panel collapsed:block",
              critical || status === "Critical" ? "bg-critical" : "bg-caution",
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
      ) : flagged ? (
        <span className={clsx("ml-auto flex items-center gap-1.5 text-[11.5px] font-medium collapsed:hidden", HEALTH_TEXT[status])} title={`Worst hazard status: ${status}`}>
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {HEALTH_LABEL[status]}
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
        className="pointer-events-none absolute left-full z-50 ml-3 hidden translate-x-[-4px] rounded-md bg-ink px-2 py-1 text-xs font-medium whitespace-nowrap text-canvas opacity-0 shadow-[var(--shadow-pop)] transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 collapsed:block"
      >
        {label}
        {count > 0 && ` · ${count}`}
      </span>
    </Link>
  );
});

const ON_WATCH_LIMIT = 4;

/** Crew in caution or critical state, worst first: the people to keep an eye on. */
function OnWatch() {
  const crew = useAstronauts({ pageSize: 100 });
  const scope = useMissionScope();
  const hydrated = useHydrated();
  if (!hydrated || !crew.data) return null;

  const watch = crew.data.items
    .filter((a) => (a.healthStatus === "Critical" || a.healthStatus === "Caution") && (!scope || a.missionId === scope))
    .sort((a, b) => RANK[b.healthStatus] - RANK[a.healthStatus] || b.openAlerts - a.openAlerts);
  if (watch.length === 0) return null;

  return (
    <section aria-label="Crew on watch" className="shrink-0 px-3 pt-2 pb-3 collapsed:hidden">
      <div className="mb-1 flex items-center justify-between px-2.5">
        <p className="text-[11.5px] font-medium text-faint">On watch</p>
        {watch.length > ON_WATCH_LIMIT && (
          <Link href="/monitor" className="text-[11.5px] font-medium text-faint transition-colors hover:text-ink">
            +{watch.length - ON_WATCH_LIMIT} more
          </Link>
        )}
      </div>
      <ul className="space-y-px">
        {watch.slice(0, ON_WATCH_LIMIT).map((a) => (
          <li key={a.id}>
            <Link
              href={`/crew/${a.id}`}
              className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-muted transition-colors hover:bg-overlay/[0.035] hover:text-ink"
            >
              <span className={clsx("size-1.5 shrink-0 rounded-full bg-current", HEALTH_TEXT[a.healthStatus])} aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                {a.firstName} {a.lastName}
              </span>
              <span className={clsx("text-[11.5px] font-medium", HEALTH_TEXT[a.healthStatus])}>{HEALTH_LABEL[a.healthStatus]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
  const tone = link.state === "connected" ? "bg-nominal" : link.state === "disconnected" ? "bg-critical" : "bg-caution";

  return (
    <Link
      href="/system"
      title="Real-time uplink"
      className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[12px] text-muted transition-colors hover:bg-overlay/[0.04] hover:text-ink collapsed:justify-center collapsed:px-0"
    >
      <span aria-hidden className={clsx("size-1.5 shrink-0 rounded-full", tone, link.state !== "connected" && "animate-blink")} />
      <span className="truncate collapsed:hidden">{LINK_TEXT[link.state]}</span>
      {link.state === "connected" && <UplinkStats latencyMs={link.latencyMs} />}
    </Link>
  );
}

/** Re-renders with every packet; kept tiny on purpose. */
function UplinkStats({ latencyMs }: { latencyMs: number | null }) {
  const rate = useEventRate();
  return (
    <span className="tnum ml-auto text-faint collapsed:hidden">
      {rate}/min{latencyMs !== null ? ` · ${latencyMs}ms` : ""}
    </span>
  );
}
