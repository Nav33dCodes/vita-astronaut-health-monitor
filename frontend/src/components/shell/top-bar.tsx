"use client";

import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { BellRing, ChevronRight, Menu, Search, Siren, WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { IconButton, Kbd } from "@/components/ui/primitives";
import { queries, useDashboard } from "@/lib/api/queries";
import { useHydrated } from "@/lib/hooks";
import { navItemFor } from "@/lib/navigation";
import { useOnline } from "@/lib/online";
import { useLinkStatus } from "@/lib/realtime/store";
import { formatUtcClock, useNow } from "@/lib/time";
import { SettingsMenu } from "./settings-menu";
import { Wordmark } from "./wordmark";

export function TopBar({ onOpenPalette, onOpenNav }: { onOpenPalette: () => void; onOpenNav: () => void }) {
  const online = useOnline();

  return (
    <div className="sticky top-0 z-20">
      {!online && (
        <div role="status" className="flex items-center justify-center gap-2 bg-caution/12 px-4 py-1.5 text-[12px] font-medium text-caution">
          <WifiOff className="size-3.5 shrink-0" aria-hidden />
          Offline. Showing the last cached data; updates resume when the connection returns.
        </div>
      )}
      <EscalationStrip />

      <header className="glass-blur flex h-14 items-center gap-3 border-b border-line px-4 sm:px-6 lg:px-8">
        {/* Mobile: menu + wordmark */}
        <IconButton onClick={onOpenNav} aria-label="Open navigation" className="-ml-1.5 lg:hidden">
          <Menu />
        </IconButton>
        <Link href="/" className="lg:hidden" aria-label="VITA overview">
          <Wordmark />
        </Link>

        <Suspense fallback={<div className="hidden lg:block" />}>
          <Breadcrumb />
        </Suspense>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <LinkPill />
          <UtcClock />

          <button
            onClick={onOpenPalette}
            className="group flex h-8 items-center gap-2 rounded-lg border border-line-strong bg-panel px-2 text-[13px] text-muted shadow-[var(--shadow-sm)] transition-colors hover:text-ink sm:w-56 sm:px-2.5 lg:w-64"
            aria-label="Search or run a command"
          >
            <Search className="size-4 shrink-0 text-faint group-hover:text-muted" aria-hidden />
            <span className="hidden flex-1 text-left sm:inline">Search or jump to…</span>
            <span className="hidden items-center gap-0.5 sm:flex">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>

          <AlertsButton />
          <SettingsMenu />
        </div>
      </header>
    </div>
  );
}

/** Overview / Crew / Daniel Reyes */
function Breadcrumb() {
  const pathname = usePathname();
  const item = navItemFor(pathname);
  const crewId = pathname.startsWith("/crew/") ? pathname.split("/")[2] : null;
  const astronaut = useQuery({ ...queries.astronaut(crewId ?? ""), enabled: crewId !== null });

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[13.5px] lg:flex">
      <span className="text-faint">VITA</span>
      {item && (
        <>
          <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden />
          {crewId ? (
            <Link href={item.href} className="text-muted transition-colors hover:text-ink">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-ink">{item.label}</span>
          )}
        </>
      )}
      {crewId && (
        <>
          <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden />
          <span className="truncate font-medium text-ink">
            {astronaut.data ? `${astronaut.data.firstName} ${astronaut.data.lastName}` : "…"}
          </span>
        </>
      )}
    </nav>
  );
}

function LinkPill() {
  const link = useLinkStatus();
  const live = link.state === "connected";
  return (
    <Link
      href="/system"
      title="Real-time uplink (SignalR)"
      className={clsx(
        "hidden h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors hover:bg-overlay/[0.05] lg:flex",
        live ? "text-muted" : link.state === "disconnected" ? "text-critical" : "text-caution",
      )}
    >
      <span
        aria-hidden
        className={clsx("size-1.5 rounded-full", live ? "bg-nominal" : link.state === "disconnected" ? "bg-critical" : "bg-caution animate-blink")}
      />
      {live ? "Live" : link.state === "disconnected" ? "Offline" : "Connecting"}
      {live && link.latencyMs !== null && <span className="tnum font-normal text-faint">{link.latencyMs}ms</span>}
    </Link>
  );
}

function UtcClock() {
  const now = useNow();
  return (
    <span className="tnum hidden h-8 items-center gap-1.5 px-2 font-mono text-[12.5px] text-ink xl:flex" title="Coordinated Universal Time">
      <span className="font-sans text-[11.5px] font-medium text-faint">UTC</span>
      {now ? formatUtcClock(now) : "--:--:--"}
    </span>
  );
}

function AlertsButton() {
  const { data } = useDashboard();
  const hydrated = useHydrated();
  const open = hydrated ? (data?.openAlerts ?? 0) : 0;
  const critical = hydrated ? (data?.openCriticalAlerts ?? 0) : 0;

  return (
    <Link
      href="/alerts"
      aria-label={`Alerts: ${open} open, ${critical} critical`}
      title={open ? `${open} open alerts · ${critical} critical` : "No open alerts"}
      className="relative grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-overlay/[0.06] hover:text-ink"
    >
      <BellRing className="size-4" aria-hidden />
      {open > 0 && (
        <span
          className={clsx(
            "tnum absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold ring-2 ring-canvas",
            critical > 0 ? "bg-critical-solid text-white" : "bg-caution text-white",
          )}
        >
          {open > 99 ? "99+" : open}
        </span>
      )}
    </Link>
  );
}

/** Only escalated (unacknowledged past the deadline) alerts earn a full-width strip. */
function EscalationStrip() {
  const { data } = useDashboard();
  const hydrated = useHydrated();
  const escalated = hydrated ? (data?.escalatedAlerts ?? 0) : 0;
  if (escalated === 0) return null;

  return (
    <div role="alert" className="flex items-center justify-center gap-3 bg-critical-solid px-4 py-1.5 text-[12.5px] font-medium text-white">
      <Siren className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">
        {escalated} escalated alert{escalated > 1 ? "s" : ""} waiting for acknowledgement
      </span>
      <Link href="/alerts" className="shrink-0 rounded-md bg-white/15 px-2 py-0.5 text-[12px] font-semibold transition-colors hover:bg-white/25">
        Review
      </Link>
    </div>
  );
}
