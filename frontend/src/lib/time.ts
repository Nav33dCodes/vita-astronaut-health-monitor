"use client";

import { useSyncExternalStore } from "react";

/*
 * One shared clock per tick interval for the whole app. Components that need "now" subscribe
 * to it instead of each running their own setInterval, so twenty live cells cost one timer and
 * all of them update in the same frame.
 */

interface Ticker {
  now: Date;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
}

const tickers = new Map<number, Ticker>();

function ticker(intervalMs: number): Ticker {
  let t = tickers.get(intervalMs);
  if (!t) {
    t = { now: new Date(), listeners: new Set(), timer: null };
    tickers.set(intervalMs, t);
  }
  return t;
}

function subscribe(intervalMs: number, listener: () => void) {
  const t = ticker(intervalMs);
  t.listeners.add(listener);
  // Never touch `now` here: subscribing must not change the snapshot, or React re-renders,
  // re-subscribes and loops. The value only moves on a tick.
  if (t.timer === null) {
    const tick = () => {
      t.now = new Date();
      t.listeners.forEach((l) => l());
    };
    t.timer = setInterval(tick, intervalMs);
    // A ticker that sat idle holds an old time: refresh it right away, asynchronously.
    setTimeout(tick, 0);
  }
  return () => {
    t.listeners.delete(listener);
    if (t.listeners.size === 0 && t.timer !== null) {
      clearInterval(t.timer);
      t.timer = null;
    }
  };
}

// Stable subscribe/snapshot functions per interval: React re-subscribes whenever the
// subscribe function identity changes, so it must not be recreated on every render.
const handles = new Map<number, { subscribe: (l: () => void) => () => void; snapshot: () => Date }>();
function handle(intervalMs: number) {
  let h = handles.get(intervalMs);
  if (!h) {
    h = { subscribe: (l) => subscribe(intervalMs, l), snapshot: () => ticker(intervalMs).now };
    handles.set(intervalMs, h);
  }
  return h;
}

const serverNow = () => null;

/** Current time, ticking every `intervalMs`. Null during server render and hydration. */
export function useNow(intervalMs = 1000): Date | null {
  const h = handle(intervalMs);
  return useSyncExternalStore(h.subscribe, h.snapshot, serverNow);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Mission Elapsed Time, e.g. "T+ 12d 04:32:10" (or "T− …" before launch). */
export function formatMet(launchDate: string, now: Date): string {
  const launch = new Date(`${launchDate}T00:00:00Z`).getTime();
  const diff = Math.floor((now.getTime() - launch) / 1000);
  const sign = diff >= 0 ? "T+" : "T−";
  const total = Math.abs(diff);
  const days = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;
  return `${sign} ${days}d ${pad(h)}:${pad(m)}:${pad(s)}`;
}

export const formatUtcClock = (now: Date) =>
  `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
