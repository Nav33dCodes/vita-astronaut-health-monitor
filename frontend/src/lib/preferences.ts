"use client";

import { useSyncExternalStore } from "react";
import { DENSITY_STORAGE_KEY, SIDEBAR_STORAGE_KEY } from "./theme-script";

/*
 * UI preferences that live as data-attributes on <html> (set before paint by the init script),
 * so CSS can react without a hydration flash. This store mirrors them for React.
 */

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the preference still applies for this session.
  }
}

// ---- Sidebar ----------------------------------------------------------------

export function setSidebarCollapsed(collapsed: boolean) {
  const root = document.documentElement;
  if (collapsed) root.dataset.sidebar = "collapsed";
  else delete root.dataset.sidebar;
  persist(SIDEBAR_STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  notify();
}

export const toggleSidebar = () => setSidebarCollapsed(document.documentElement.dataset.sidebar !== "collapsed");

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.sidebar === "collapsed",
    () => false,
  );
}

// ---- Density ----------------------------------------------------------------

export type Density = "comfortable" | "compact";

export function setDensity(density: Density) {
  const root = document.documentElement;
  if (density === "compact") root.dataset.density = "compact";
  else delete root.dataset.density;
  persist(DENSITY_STORAGE_KEY, density);
  notify();
}

export function useDensity(): Density {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.density === "compact" ? "compact" : "comfortable"),
    () => "comfortable",
  );
}
