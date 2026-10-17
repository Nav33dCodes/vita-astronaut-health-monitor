"use client";

import { useMemo } from "react";
import { useTelemetrySnapshot } from "@/lib/api/queries";
import type { VitalReading } from "@/lib/api/types";
import { useNow } from "@/lib/time";
import { useEventLog, useLiveReadings } from "./store";

const BUFFER = 60;

/** Snapshot history merged with packets pushed over SignalR — the live monitor buffer. */
export function useLiveVitals(astronautId: string): { readings: VitalReading[]; isLoading: boolean } {
  const snapshot = useTelemetrySnapshot();
  const history = snapshot.data?.get(astronautId);
  const live = useLiveReadings(astronautId);

  const readings = useMemo(() => {
    const seen = new Set<string>();
    return [...(history ?? []), ...live]
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      .sort((a, b) => a.recordedAtUtc.localeCompare(b.recordedAtUtc))
      .slice(-BUFFER);
  }, [history, live]);

  return { readings, isLoading: snapshot.isPending };
}

export type SignalQuality = "live" | "stale" | "lost";

/** Packet freshness: live < 20s, stale < 90s, otherwise lost. */
export function useSignalQuality(lastPacketIso: string | undefined): { quality: SignalQuality; ageSeconds: number | null } {
  const now = useNow(1000);
  if (!lastPacketIso || !now) return { quality: "lost", ageSeconds: null };
  const age = Math.max(0, Math.round((now.getTime() - new Date(lastPacketIso).getTime()) / 1000));
  return { quality: age < 20 ? "live" : age < 90 ? "stale" : "lost", ageSeconds: age };
}

/** Events per minute over the trailing minute. */
export function useEventRate(): number {
  const events = useEventLog();
  const now = useNow(2000);
  if (!now) return 0;
  const cutoff = now.getTime() - 60_000;
  let count = 0;
  for (const event of events) {
    if (event.at < cutoff) break; // newest first
    count++;
  }
  return count;
}
