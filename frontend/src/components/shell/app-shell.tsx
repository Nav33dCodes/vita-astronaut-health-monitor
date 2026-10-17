"use client";

import clsx from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { MasterAlarm } from "@/components/alerts/master-alarm";
import { Logo } from "@/components/brand/logo";
import { useDashboard } from "@/lib/api/queries";
import { useHydrated } from "@/lib/hooks";
import { BRAND } from "@/lib/brand";
import { NAV_SECTIONS } from "@/lib/navigation";
import { prefetchRoute } from "@/lib/prefetch";
import { useEventRate } from "@/lib/realtime/hooks";
import { useLinkStatus } from "@/lib/realtime/store";
import { CommandPalette } from "./command-palette";
import { LoadingBar } from "./loading-bar";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="glass glass-blur z-20 border-0 border-b md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-b-0">
        <Link href="/" className="block px-6 py-5 md:py-6" aria-label={`${BRAND.name} home`}>
          <Logo />
        </Link>

        {/* The current path is only known at request time, so the nav streams in. */}
        <Suspense fallback={<Nav pathname={null} />}>
          <ActiveNav />
        </Suspense>

        <LinkCard />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 md:px-10">{children}</main>
      </div>

      <LoadingBar />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <MasterAlarm />
    </div>
  );
}

function ActiveNav() {
  return <Nav pathname={usePathname()} />;
}

function Nav({ pathname }: { pathname: string | null }) {
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
  const critical = (data?.openCriticalAlerts ?? 0) > 0;

  const isActive = (href: string) => current !== null && (href === "/" ? current === "/" : current.startsWith(href));

  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:gap-5 md:overflow-y-auto md:px-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="flex gap-1 md:flex-col">
          <p className="hud-label hidden px-3 pb-1 !text-[9px] md:block">{section.title}</p>
          {section.items.map(({ href, label, icon: Icon, badge }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                onMouseEnter={() => prefetchRoute(client, href)}
                onFocus={() => prefetchRoute(client, href)}
                onClick={(e) => {
                  // Let modified clicks (new tab/window) behave natively.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  if (!isActive(href)) setPending({ href, from: pathname });
                }}
                className={clsx(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors duration-200",
                  active ? "bg-accent/[0.09] text-ink" : "text-muted hover:bg-overlay/[0.04] hover:text-ink",
                )}
              >
                <span
                  aria-hidden
                  className={clsx(
                    "absolute top-2 bottom-2 left-0 hidden w-0.5 origin-center rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)] transition-[opacity,transform] duration-300 ease-out md:block",
                    active ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
                  )}
                />
                <Icon className={clsx("size-4 transition-colors duration-200", active && "text-accent")} aria-hidden />
                {label}
                {navigating && pending.href === href && (
                  <Loader2 className="ml-auto size-3.5 animate-spin text-accent" aria-label="Loading" />
                )}
                {badge === "alerts" && openAlerts > 0 && !(navigating && pending.href === href) && (
                  <span
                    className={clsx(
                      "ml-auto rounded-full px-1.5 py-px font-mono text-[10px] font-semibold",
                      critical ? "bg-critical text-white shadow-[0_0_12px_var(--color-critical)]" : "bg-caution text-canvas",
                    )}
                  >
                    {openAlerts}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

const LINK_LABEL = {
  connected: "Uplink nominal",
  connecting: "Acquiring signal",
  reconnecting: "Re-acquiring",
  disconnected: "Uplink lost",
} as const;

/** Compact uplink summary at the foot of the sidebar. */
function LinkCard() {
  const link = useLinkStatus();
  const rate = useEventRate();
  const tone =
    link.state === "connected" ? "text-nominal" : link.state === "disconnected" ? "text-critical" : "text-caution";

  return (
    <Link href="/system" className="mt-auto hidden px-4 pb-5 md:block">
      <div className="rounded-xl border border-line bg-overlay/[0.02] p-3 transition hover:border-accent/30">
        <div className="flex items-center justify-between">
          <p className="hud-label !text-[9px]">SignalR uplink</p>
          <span className={clsx("flex items-center gap-1.5 font-mono text-[10px]", tone)}>
            <span aria-hidden className="size-1.5 animate-blink rounded-full bg-current shadow-[0_0_8px_currentColor]" />
            {LINK_LABEL[link.state]}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
          <span className="text-muted">
            <Activity className="mr-1 inline size-3" aria-hidden />
            {rate}/min
          </span>
          <span className="text-right text-muted">{link.latencyMs !== null ? `${link.latencyMs} ms` : "— ms"}</span>
        </div>
      </div>
    </Link>
  );
}
