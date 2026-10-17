"use client";

import type { QueryClient } from "@tanstack/react-query";
import { queries } from "@/lib/api/queries";

/** Page sizes shared by pages and the prefetcher, so prefetched entries match exactly. */
export const PAGE_SIZE = {
  overviewAlerts: 3,
  alerts: 10,
  crewTable: 12,
  crewGrid: 9,
} as const;

/**
 * Warms the cache with exactly the queries a section renders first. Called on sidebar hover /
 * focus, so by the time the click lands the data is usually already there — no skeleton flash.
 * Fresh entries are skipped automatically (staleTime), so repeated hovers cost nothing.
 */
const ROUTE_DATA: Record<string, (client: QueryClient) => Promise<unknown>[]> = {
  "/": (c) => [
    c.prefetchQuery(queries.dashboard()),
    c.prefetchQuery(queries.alerts({ status: "Open", page: 1, pageSize: PAGE_SIZE.overviewAlerts })),
    c.prefetchQuery(queries.astronauts({ pageSize: 100 })),
    c.prefetchQuery(queries.thresholds()),
    c.prefetchQuery(queries.fleetAssessments()),
    c.prefetchQuery(queries.telemetrySnapshot()),
  ],
  "/monitor": (c) => [
    c.prefetchQuery(queries.missions()),
    c.prefetchQuery(queries.astronauts({ pageSize: 100 })),
    c.prefetchQuery(queries.thresholds()),
    c.prefetchQuery(queries.telemetrySnapshot()),
  ],
  "/alerts": (c) => [
    c.prefetchQuery(queries.dashboard()),
    c.prefetchQuery(queries.alerts({ status: "Open", page: 1, pageSize: PAGE_SIZE.alerts })),
  ],
  "/crew": (c) => [
    c.prefetchQuery(queries.missions()),
    c.prefetchQuery(queries.astronauts({ page: 1, pageSize: PAGE_SIZE.crewTable })),
  ],
  "/missions": (c) => [c.prefetchQuery(queries.missions())],
  "/protocols": (c) => [
    c.prefetchQuery(queries.thresholds()),
    c.prefetchQuery(queries.earlyWarningScoring()),
    c.prefetchQuery(queries.systemStatus()),
  ],
  "/system": (c) => [c.prefetchQuery(queries.systemStatus())],
};

export function prefetchRoute(client: QueryClient, href: string) {
  // Prefetch failures are harmless — the page simply fetches on mount as usual.
  void Promise.allSettled(ROUTE_DATA[href]?.(client) ?? []);
}
