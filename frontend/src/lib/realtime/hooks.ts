"use client";

import { useMemo } from "react";
import { useTelemetrySnapshot } from "@/lib/api/queries";
import type { VitalReading } from "@/lib/api/types";
import { useNow } from "@/lib/time";
import { useAllLiveReadings, useEventLog, useLiveReadings } from "./store";

export { useEventRate } from "./store";

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

const mergeReadings = (history: VitalReading[] | undefined, live: VitalReading[] | undefined) => {
  const seen = new Set<string>();
  return [...(history ?? []), ...(live ?? [])]
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((a, b) => a.recordedAtUtc.localeCompare(b.recordedAtUtc))
    .slice(-BUFFER);
};

// Per-astronaut memo shared by every caller: same inputs → the same merged array instance.
const mergedCache = new Map<string, { history?: VitalReading[]; live?: VitalReading[]; merged: VitalReading[] }>();
function mergedFor(id: string, history: VitalReading[] | undefined, live: VitalReading[] | undefined) {
  const previous = mergedCache.get(id);
  if (previous && previous.history === history && previous.live === live) return previous.merged;
  const merged = mergeReadings(history, live);
  mergedCache.set(id, { history, live, merged });
  return merged;
}

/**
 * Live buffers for the whole fleet in one subscription: snapshot history + SignalR pushes.
 * Each astronaut's array keeps its identity until their own data changes, so memoized rows
 * for everyone else skip re-rendering when one crew member's packet arrives.
 */
export function useFleetReadings(): { byAstronaut: Map<string, VitalReading[]>; isLoading: boolean } {
  const snapshot = useTelemetrySnapshot();
  const live = useAllLiveReadings();

  const byAstronaut = useMemo(() => {
    const ids = new Set([...(snapshot.data?.keys() ?? []), ...Object.keys(live)]);
    return new Map([...ids].map((id) => [id, mergedFor(id, snapshot.data?.get(id), live[id])]));
  }, [snapshot.data, live]);

  return { byAstronaut, isLoading: snapshot.isPending };
}

/** Packets per bucket over a trailing window, oldest first: the data behind throughput sparklines. */
export function useEventRateSeries(buckets = 20, bucketSeconds = 30): number[] {
  const events = useEventLog();
  const now = useNow(5000);
  return useMemo(() => {
    const counts = Array<number>(buckets).fill(0);
    if (!now) return counts;
    const end = now.getTime();
    for (const e of events) {
      if (e.kind !== "reading") continue;
      const index = buckets - 1 - Math.floor((end - e.at) / (bucketSeconds * 1000));
      if (index < 0) break; // newest first: everything after is older
      if (index < buckets) counts[index]++;
    }
    return counts;
  }, [events, now, buckets, bucketSeconds]);
}

export type SignalQuality = "live" | "stale" | "lost";

/** Packet freshness: live < 20s, stale < 90s, otherwise lost. */
export function useSignalQuality(lastPacketIso: string | undefined): { quality: SignalQuality; ageSeconds: number | null } {
  const now = useNow(1000);
  if (!lastPacketIso || !now) return { quality: "lost", ageSeconds: null };
  const age = Math.max(0, Math.round((now.getTime() - new Date(lastPacketIso).getTime()) / 1000));
  return { quality: age < 20 ? "live" : age < 90 ? "stale" : "lost", ageSeconds: age };
}

