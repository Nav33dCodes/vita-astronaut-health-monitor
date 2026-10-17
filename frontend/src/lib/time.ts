"use client";

import { useEffect, useState } from "react";

/** Current time, ticking. Null until mounted so server and client markup match. */
export function useNow(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
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
