"use client";

import { useSyncExternalStore } from "react";

/*
 * The mission the operator is focused on, chosen in the sidebar's mission switcher.
 * Null means "all missions". Pages that list crew (Overview, Live monitor, Crew, Hazards)
 * follow it, and their own mission filters write back to it, so the focus is the same everywhere.
 */

const KEY = "vita:mission-scope";
const listeners = new Set<() => void>();
let cached: string | null | undefined;

function read(): string | null {
  if (cached !== undefined) return cached;
  try {
    cached = localStorage.getItem(KEY) || null;
  } catch {
    cached = null;
  }
  return cached;
}

export function setMissionScope(missionId: string | null) {
  cached = missionId;
  try {
    if (missionId) localStorage.setItem(KEY, missionId);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: the scope still applies for this session.
  }
  listeners.forEach((notify) => notify());
}

/** Selected mission id, or null for all missions. Null during server render and hydration. */
function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

const serverScope = () => null;

export function useMissionScope(): string | null {
  return useSyncExternalStore(subscribe, read, serverScope);
}
