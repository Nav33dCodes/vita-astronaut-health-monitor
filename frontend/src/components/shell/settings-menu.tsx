"use client";

import clsx from "clsx";
import { Bell, BellOff, Monitor, Moon, Rows3, Rows4, Settings2, Sun, Volume2, VolumeX } from "lucide-react";
import type { ReactNode } from "react";
import { MenuLabel, MenuSeparator, Popover } from "@/components/ui/popover";
import { IconButton } from "@/components/ui/primitives";
import { disableDesktopAlerts, enableDesktopAlerts, showDesktopAlert, useDesktopAlerts } from "@/lib/notifications";
import { confirm, setNotificationMode, useNotificationMode, type NotificationMode } from "@/lib/notify";
import { setDensity, useDensity } from "@/lib/preferences";
import { setSoundEnabled, useSoundEnabled } from "@/lib/sound";
import { setThemePreference, useTheme, type ThemePreference } from "@/lib/theme";

const MODES: { value: NotificationMode; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "all", label: "All" },
  { value: "mute", label: "Mute" },
];

const MODE_HINT: Record<NotificationMode, string> = {
  critical: "Pop-ups for critical events only. Everything else goes to the inbox.",
  all: "Pop-ups for warnings and critical events.",
  mute: "No pop-ups or sounds. Escalations still take over the screen.",
};

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** One quiet place for every display and notification preference. */
export function SettingsMenu() {
  const { preference } = useTheme();
  const density = useDensity();
  const soundOn = useSoundEnabled();
  const desktop = useDesktopAlerts();
  const mode = useNotificationMode();

  const toggleDesktop = async () => {
    if (desktop === "on") return disableDesktopAlerts();
    if (desktop === "denied") {
      confirm.failed("Desktop alerts are blocked", "Allow notifications for this site in your browser settings.");
      return;
    }
    const result = await enableDesktopAlerts();
    if (result === "on") {
      confirm.done("Desktop alerts on");
      showDesktopAlert({ title: "VITA desktop alerts on", body: "You'll be notified of critical alerts and escalations.", tag: "vita-test" });
    }
  };

  return (
    <Popover
      width="17rem"
      trigger={({ toggle, open, ...aria }) => (
        <IconButton onClick={toggle} active={open} aria-label="Settings" title="Settings" {...aria}>
          <Settings2 />
        </IconButton>
      )}
    >
      <MenuLabel>Theme</MenuLabel>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 px-1 pb-1">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            role="radio"
            aria-checked={preference === value}
            onClick={() => setThemePreference(value)}
            className={clsx(
              "flex flex-col items-center gap-1 rounded-lg py-2 text-[12px] font-medium transition-colors",
              preference === value ? "bg-accent/10 text-accent ring-1 ring-accent/25 ring-inset" : "text-muted hover:bg-overlay/[0.05] hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <MenuSeparator />
      <MenuLabel>Display</MenuLabel>
      <Row
        icon={density === "compact" ? <Rows4 /> : <Rows3 />}
        label="Compact tables"
        checked={density === "compact"}
        onChange={() => setDensity(density === "compact" ? "comfortable" : "compact")}
      />

      <MenuSeparator />
      <MenuLabel>Notifications</MenuLabel>
      <div role="radiogroup" aria-label="Pop-up notifications" className="grid grid-cols-3 gap-1 px-1">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            role="radio"
            aria-checked={mode === value}
            onClick={() => setNotificationMode(value)}
            className={clsx(
              "h-8 rounded-lg text-[12px] font-medium transition-colors",
              mode === value ? "bg-accent/10 text-accent ring-1 ring-accent/25 ring-inset" : "text-muted hover:bg-overlay/[0.05] hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="px-2.5 pt-1.5 pb-1 text-[11.5px] leading-snug text-faint">{MODE_HINT[mode]}</p>
      <Row
        icon={soundOn ? <Volume2 /> : <VolumeX />}
        label="Sound for critical alerts"
        checked={soundOn && mode !== "mute"}
        onChange={() => setSoundEnabled(!soundOn)}
      />
      {desktop !== "unsupported" && (
        <Row
          icon={desktop === "on" ? <Bell /> : <BellOff />}
          label="Desktop alerts"
          hint={desktop === "denied" ? "Blocked in browser" : undefined}
          checked={desktop === "on"}
          onChange={toggleDesktop}
        />
      )}
    </Popover>
  );
}

function Row({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-overlay/[0.05] [&>svg]:size-4 [&>svg]:text-muted"
    >
      {icon}
      <span className="flex-1">
        {label}
        {hint && <span className="block text-[11.5px] text-faint">{hint}</span>}
      </span>
      <Switch checked={checked} />
    </button>
  );
}

export function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "relative h-[18px] w-8 shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-accent" : "bg-line-strong",
      )}
    >
      <span
        className={clsx(
          "absolute top-[2px] left-[2px] size-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
          checked && "translate-x-[14px]",
        )}
      />
    </span>
  );
}
