"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";

/**
 * Bump whenever API response shapes change: a cache written by an older build is then discarded
 * instead of being rendered with the wrong shape.
 */
export const CACHE_BUSTER = "vita-2026-10-a";

/** Persisted entries older than this are ignored on startup. Must not exceed the queries' gcTime. */
export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Small, slow-changing lists that make a revisit render instantly from the browser cache while
 * fresh data loads in the background (stale-while-revalidate). Deliberately excluded:
 *  - telemetry-snapshot: a Map (not serialisable) and rebuilt live by SignalR anyway
 *  - vital-series / vital-stats: large chart payloads, cheap to refetch per astronaut
 */
const PERSISTED_KEYS = new Set([
  "dashboard",
  "missions",
  "astronauts",
  "astronaut",
  "alerts",
  "thresholds",
  "early-warning-scoring",
  "assessments",
  "system-status",
]);

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined; // storage blocked (privacy mode, policies) — persistence silently off
  }
}

export function createPersistOptions(): Omit<PersistQueryClientOptions, "queryClient"> {
  return {
    persister: createSyncStoragePersister({
      storage: safeLocalStorage(),
      key: "vita:query-cache",
      throttleTime: 2_000, // live data changes often; batch writes to storage
    }),
    maxAge: PERSIST_MAX_AGE_MS,
    buster: CACHE_BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => query.state.status === "success" && PERSISTED_KEYS.has(String(query.queryKey[0])),
    },
  };
}
