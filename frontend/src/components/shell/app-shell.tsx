"use client";

import clsx from "clsx";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { MasterAlarm } from "@/components/alerts/master-alarm";
import { Drawer } from "@/components/ui/dialog";
import { useDashboard } from "@/lib/api/queries";
import { useHydrated } from "@/lib/hooks";
import { NAV_ITEMS, isActivePath } from "@/lib/navigation";
import { CommandPalette } from "./command-palette";
import { LoadingBar } from "./loading-bar";
import { ShortcutsDialog, useGlobalShortcuts } from "./shortcuts";
import { NavList, Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { Wordmark } from "./wordmark";

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useGlobalShortcuts({
    onPalette: () => setPaletteOpen((o) => !o),
    onHelp: () => setShortcutsOpen(true),
  });

  return (
    <div className="flex min-h-dvh">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} onOpenNav={() => setNavOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>

      <Suspense fallback={null}>
        <MobileTabBar onMore={() => setNavOpen(true)} />
      </Suspense>

      <Drawer open={navOpen} onClose={() => setNavOpen(false)} side="left" width="17rem" label="Navigation">
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center px-5">
            <Wordmark />
          </div>
          <Suspense fallback={<NavList pathname={null} />}>
            <DrawerNav onNavigate={() => setNavOpen(false)} />
          </Suspense>
        </div>
      </Drawer>

      <LoadingBar />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onShowShortcuts={() => setShortcutsOpen(true)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <MasterAlarm />
    </div>
  );
}

function DrawerNav({ onNavigate }: { onNavigate: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

const TABS = NAV_ITEMS.filter((item) => item.primary);

/** Phone navigation: four primary destinations plus "More", in thumb reach. */
function MobileTabBar({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const { data } = useDashboard();
  const hydrated = useHydrated();
  const openAlerts = hydrated ? (data?.openAlerts ?? 0) : 0;
  const critical = hydrated && (data?.openCriticalAlerts ?? 0) > 0;
  const onPrimary = TABS.some((t) => isActivePath(t.href, pathname));

  return (
    <nav
      aria-label="Primary"
      className="glass-blur fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TABS.map(({ href, label, icon: Icon, badge }) => {
        const active = isActivePath(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "relative flex h-14 flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors",
              active ? "text-ink" : "text-faint",
            )}
          >
            <span className="relative">
              <Icon className="size-[19px]" aria-hidden strokeWidth={active ? 2.1 : 1.8} />
              {badge === "alerts" && openAlerts > 0 && (
                <span
                  className={clsx(
                    "tnum absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9.5px] font-semibold text-white ring-2 ring-panel",
                    critical ? "bg-critical-solid" : "bg-caution",
                  )}
                >
                  {openAlerts > 99 ? "99+" : openAlerts}
                </span>
              )}
            </span>
            {label.replace("Live monitor", "Monitor")}
          </Link>
        );
      })}
      <button
        onClick={onMore}
        className={clsx("flex h-14 flex-col items-center justify-center gap-1 text-[10.5px] font-medium", onPrimary ? "text-faint" : "text-ink")}
      >
        <MoreHorizontal className="size-[19px]" aria-hidden />
        More
      </button>
    </nav>
  );
}
