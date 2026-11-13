"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DEFAULT_THEME, LIGHT_QUERY, THEME_STORAGE_KEY as KEY } from "./theme-script";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark";
}

function apply(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function subscribe(notify: () => void) {
  const media = window.matchMedia(LIGHT_QUERY);
  const onSystemChange = () => {
    if (readPreference() === "system") apply(resolve("system"));
    notify();
  };
  listeners.add(notify);
  media.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(notify);
    media.removeEventListener("change", onSystemChange);
  };
}

export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(KEY, preference);
  } catch {
    // Storage unavailable — theme still applies for this session.
  }
  apply(resolve(preference));
  listeners.forEach((notify) => notify());
}

/** Current preference and the theme actually applied. */
export function useTheme() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      const preference = readPreference();
      return `${preference}|${resolve(preference)}`;
    },
    () => `${DEFAULT_THEME}|${DEFAULT_THEME}`,
  );
  const [preference, resolved] = snapshot.split("|") as [ThemePreference, ResolvedTheme];
  return { preference, resolved };
}

/** Theme token values as concrete colours, for libraries that can't use CSS variables (charts). */
export function useThemeColors() {
  const { resolved } = useTheme();
  return useMemo(() => {
    const fallback = { accent: "#4f5ff0", violet: "#8b7cf6", nominal: "#0b7f3d", caution: "#b45309", critical: "#d1343a", grid: "#efeff2", axis: "#71717b", panel: "#ffffff", line: "#dcdce1", muted: "#5c5c66", canvas: "#f7f7f8", ink: "#111114" };
    if (typeof window === "undefined") return fallback;
    const css = getComputedStyle(document.documentElement);
    const read = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
    return {
      accent: read("--color-accent", fallback.accent),
      violet: read("--color-violet", fallback.violet),
      nominal: read("--color-nominal", fallback.nominal),
      caution: read("--color-caution", fallback.caution),
      critical: read("--color-critical", fallback.critical),
      ink: read("--color-ink", fallback.ink),
      grid: read("--color-track", fallback.grid),
      axis: read("--color-faint", fallback.axis),
      panel: read("--color-panel", fallback.panel),
      line: read("--color-line-strong", fallback.line),
      muted: read("--color-muted", fallback.muted),
      canvas: read("--color-canvas", fallback.canvas),
    };
    // `resolved` is the dependency that matters: colours change when the theme does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);
}
