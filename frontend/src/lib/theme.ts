"use client";

import { useMemo, useSyncExternalStore } from "react";
import { LIGHT_QUERY, THEME_STORAGE_KEY as KEY } from "./theme-script";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
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
    () => "system|dark",
  );
  const [preference, resolved] = snapshot.split("|") as [ThemePreference, ResolvedTheme];
  return { preference, resolved };
}

/** Theme token values as concrete colours, for libraries that can't use CSS variables (charts). */
export function useThemeColors() {
  const { resolved } = useTheme();
  return useMemo(() => {
    const fallback = { accent: "#22d3ee", violet: "#a78bfa", nominal: "#34d399", grid: "#1e293b", axis: "#56627d", panel: "#0a0f1c", line: "#1e293b", muted: "#8494b2", canvas: "#04060c" };
    if (typeof window === "undefined") return fallback;
    const css = getComputedStyle(document.documentElement);
    const read = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
    return {
      accent: read("--color-accent", fallback.accent),
      violet: read("--color-violet", fallback.violet),
      nominal: read("--color-nominal", fallback.nominal),
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
