"use client";

import clsx from "clsx";
import { BellOff, BellRing, Search, Siren, Volume2, VolumeX, WifiOff } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useDashboard, useMissions } from "@/lib/api/queries";
import { disableDesktopAlerts, enableDesktopAlerts, showDesktopAlert, useDesktopAlerts } from "@/lib/notifications";
import { useOnline } from "@/lib/online";
import { useLinkStatus, type LinkState } from "@/lib/realtime/store";
import { setSoundEnabled, useSoundEnabled } from "@/lib/sound";
import { formatMet, formatUtcClock, useNow } from "@/lib/time";
import { ThemeToggle } from "./theme-toggle";

const LINK_PILL: Record<LinkState, { label: string; className: string }> = {
  connected: { label: "Live", className: "border-nominal/30 text-nominal" },
  connecting: { label: "Connecting", className: "border-caution/35 text-caution" },
  reconnecting: { label: "Reconnecting", className: "border-caution/35 text-caution" },
  disconnected: { label: "Offline · polling", className: "border-critical/40 text-critical" },
};

/** Opt-in for native desktop notifications (critical alerts and escalations). */
function DesktopAlertsToggle() {
  const state = useDesktopAlerts();
  if (state === "unsupported") return null;

  const on = state === "on";
  const label =
    state === "denied" ? "Desktop alerts blocked in browser settings" : on ? "Disable desktop alerts" : "Enable desktop alerts";

  const toggle = async () => {
    if (on) {
      disableDesktopAlerts();
      return;
    }
    if (state === "denied") {
      toast.error("Desktop alerts are blocked", {
        description: "Allow notifications for this site in your browser's site settings, then try again.",
      });
      return;
    }
    const result = await enableDesktopAlerts();
    if (result === "on") {
      toast.success("Desktop alerts enabled", { description: "Critical alerts will reach you even when this tab is hidden." });
      showDesktopAlert({ title: "VITA desktop alerts on", body: "You'll be notified of critical alerts and escalations.", tag: "vita-test" });
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={clsx(
        "grid size-9 place-items-center rounded-xl border bg-overlay/[0.03] transition",
        on ? "border-accent/40 text-accent" : "border-line text-muted hover:text-ink",
      )}
    >
      {on ? <BellRing className="size-4" /> : <BellOff className="size-4" />}
    </button>
  );
}

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const now = useNow();
  const missions = useMissions();
  const dashboard = useDashboard();
  const soundOn = useSoundEnabled();
  const online = useOnline();

  // The longest-running active mission drives the headline MET clock.
  const primary = missions.data
    ?.filter((m) => m.status === "Active")
    .sort((a, b) => a.launchDate.localeCompare(b.launchDate))[0];

  const criticalCount = dashboard.data?.openCriticalAlerts ?? 0;
  const escalatedCount = dashboard.data?.escalatedAlerts ?? 0;
  const link = useLinkStatus();
  const pill = LINK_PILL[link.state];

  return (
    <div className="sticky top-0 z-10 border-b border-line bg-canvas/70 backdrop-blur-xl">
      {!online && (
        <div role="status" className="flex items-center justify-center gap-2 bg-caution/15 py-1 font-mono text-[10.5px] tracking-[0.14em] text-caution uppercase">
          <WifiOff className="size-3.5" aria-hidden />
          Offline · showing last cached data — updates resume when the connection returns
        </div>
      )}
      {/* Alarm strips, most severe wins: escalated (master alarm) > open critical (master caution). */}
      {escalatedCount > 0 ? (
        <Link
          href="/alerts"
          className="flex animate-blink items-center justify-center gap-2 bg-critical py-1 font-mono text-[10.5px] font-semibold tracking-[0.18em] text-white uppercase"
        >
          <Siren className="size-3.5" aria-hidden />
          Master alarm · {escalatedCount} escalated alert{escalatedCount > 1 ? "s" : ""} unacknowledged
        </Link>
      ) : criticalCount > 0 && (
        <Link
          href="/alerts"
          className="flex items-center justify-center gap-2 bg-critical/12 py-1 font-mono text-[10.5px] tracking-[0.18em] text-critical uppercase transition hover:bg-critical/20"
        >
          <span aria-hidden className="size-1.5 animate-blink rounded-full bg-current" />
          Master caution · {criticalCount} critical alert{criticalCount > 1 ? "s" : ""} open
        </Link>
      )}
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 md:px-10">
        <div className="hidden items-center gap-6 font-mono text-xs sm:flex">
          {primary && (
            <div className="flex items-baseline gap-2">
              <span className="hud-label !text-[9.5px]">MET · {primary.name}</span>
              <span className="tabular-nums text-accent">{now ? formatMet(primary.launchDate, now) : "T+ --d --:--:--"}</span>
            </div>
          )}
          <div className="flex items-baseline gap-2">
            <span className="hud-label !text-[9.5px]">UTC</span>
            <span className="tabular-nums text-ink">{now ? formatUtcClock(now) : "--:--:--"}</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/system"
            title="Real-time link (SignalR)"
            className={clsx(
              "hidden items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] tracking-widest uppercase transition hover:brightness-125 md:inline-flex",
              pill.className,
            )}
          >
            <span aria-hidden className="size-1.5 animate-blink rounded-full bg-current shadow-[0_0_8px_currentColor]" />
            {pill.label}
            {link.state === "connected" && link.latencyMs !== null && (
              <span className="text-muted normal-case tracking-normal">{link.latencyMs}ms</span>
            )}
          </Link>

          <button
            onClick={onOpenPalette}
            className="flex h-9 items-center gap-2 rounded-xl border border-line bg-overlay/[0.03] px-3 text-xs text-muted transition hover:border-accent/40 hover:text-ink"
          >
            <Search className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Search crew, pages…</span>
            <kbd className="ml-2 hidden rounded-md border border-line px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
          </button>

          <ThemeToggle />

          <DesktopAlertsToggle />

          <button
            onClick={() => setSoundEnabled(!soundOn)}
            aria-label={soundOn ? "Mute alert sounds" : "Unmute alert sounds"}
            aria-pressed={soundOn}
            className="grid size-9 place-items-center rounded-xl border border-line bg-overlay/[0.03] text-muted transition hover:text-ink"
          >
            {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
