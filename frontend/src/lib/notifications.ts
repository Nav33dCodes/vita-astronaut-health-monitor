"use client";

import { useSyncExternalStore } from "react";

/*
 * Native desktop notifications (Notification API) so critical events reach the flight
 * surgeon even when the dashboard tab is in the background. No external service needed.
 */

const KEY = "vita:desktop-alerts";
const listeners = new Set<() => void>();

export type DesktopAlertState = "unsupported" | "denied" | "off" | "on";

const supported = () => typeof window !== "undefined" && "Notification" in window;

function readState(): DesktopAlertState {
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  let wanted = true;
  try {
    wanted = localStorage.getItem(KEY) !== "off";
  } catch {
    // Storage unavailable — fall back to the permission alone.
  }
  return Notification.permission === "granted" && wanted ? "on" : "off";
}

const notify = () => listeners.forEach((listener) => listener());

export function useDesktopAlerts(): DesktopAlertState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readState,
    () => "off",
  );
}

/** Must be called from a user gesture (click) — browsers block permission prompts otherwise. */
export async function enableDesktopAlerts(): Promise<DesktopAlertState> {
  if (!supported()) return "unsupported";
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  try {
    localStorage.setItem(KEY, permission === "granted" ? "on" : "off");
  } catch {
    // Ignore — preference simply won't persist.
  }
  notify();
  return readState();
}

export function disableDesktopAlerts() {
  try {
    localStorage.setItem(KEY, "off");
  } catch {
    // Ignore.
  }
  notify();
}

interface DesktopAlert {
  title: string;
  body: string;
  /** Same tag replaces the previous notification instead of stacking duplicates. */
  tag: string;
  /** Keep it on screen until dismissed (critical events). */
  sticky?: boolean;
  onClick?: () => void;
}

export function showDesktopAlert({ title, body, tag, sticky, onClick }: DesktopAlert) {
  if (readState() !== "on") return;
  try {
    const notification = new Notification(title, { body, tag, requireInteraction: sticky, icon: "/icons/icon-192.png" });
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
  } catch {
    // Some platforms (e.g. iOS Safari without a PWA) throw — the in-app toast still fires.
  }
}
