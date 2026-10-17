"use client";

import clsx from "clsx";
import { Monitor, Moon, Sun } from "lucide-react";
import { setThemePreference, useTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "Match system theme", icon: Monitor },
];

export function ThemeToggle() {
  const { preference } = useTheme();

  return (
    <div role="radiogroup" aria-label="Theme" className="flex h-9 items-center rounded-xl border border-line bg-overlay/[0.03] p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={preference === value}
          aria-label={label}
          title={label}
          onClick={() => setThemePreference(value)}
          className={clsx(
            "grid h-full w-7 place-items-center rounded-lg transition",
            preference === value ? "bg-panel text-accent shadow-sm ring-1 ring-line-strong" : "text-muted hover:text-ink",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
