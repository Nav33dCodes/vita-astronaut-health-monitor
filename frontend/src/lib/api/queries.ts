"use client";

import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsLive } from "@/lib/realtime/store";
import { API_BASE_URL, api, withQuery } from "./client";
import type {
  Alert,
  AlertQuery,
  AstronautDetail,
  AstronautQuery,
  AstronautSummary,
  CreateMissionRequest,
  DashboardSummary,
  EarlyWarningScoring,
  HealthAssessment,
  Mission,
  MissionStatus,
  PagedResult,
  RecordVitalsRequest,
  RecordVitalsResponse,
  SystemStatus,
  TelemetrySnapshot,
  Threshold,
  UpsertAstronautRequest,
  VitalSeries,
  VitalStats,
} from "./types";

/** Polling is only a fallback: while SignalR is connected, pushes keep caches fresh. */
const FALLBACK_POLL_MS = 15_000;
function usePollFallback() {
  return useIsLive() ? false : FALLBACK_POLL_MS;
}

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  missions: ["missions"] as const,
  astronauts: (query?: AstronautQuery) => ["astronauts", query ?? {}] as const,
  astronaut: (id: string) => ["astronaut", id] as const,
  telemetrySnapshot: ["telemetry-snapshot"] as const,
  vitalSeries: (id: string, hours: number, buckets: number) => ["vital-series", id, hours, buckets] as const,
  vitalStats: (id: string, hours: number) => ["vital-stats", id, hours] as const,
  thresholds: ["thresholds"] as const,
  alerts: (query?: AlertQuery) => ["alerts", query ?? {}] as const,
  systemStatus: ["system-status"] as const,
  assessments: ["assessments"] as const,
  assessment: (id: string) => ["assessments", id] as const,
  apiHealth: ["api-health"] as const,
  earlyWarningScoring: ["early-warning-scoring"] as const,
};

/** Anything that changes health data affects these views. */
const HEALTH_KEYS = [["dashboard"], ["astronauts"], ["astronaut"], ["vital-series"], ["vital-stats"], ["alerts"]];

function useInvalidateHealth() {
  const client = useQueryClient();
  return () => Promise.all(HEALTH_KEYS.map((queryKey) => client.invalidateQueries({ queryKey })));
}

// ---- Query definitions ---------------------------------------------------
// Shared by the hooks below and by route prefetching, so a prefetched entry is exactly the
// entry the page reads (same key, same fetcher) — no duplicate request, no skeleton flash.

const ASSESSMENT_REFRESH_MS = 30_000;

export const queries = {
  dashboard: () =>
    queryOptions({
      queryKey: queryKeys.dashboard,
      queryFn: () => api.get<DashboardSummary>("/api/v1/dashboard/summary"),
    }),
  missions: () =>
    queryOptions({ queryKey: queryKeys.missions, queryFn: () => api.get<Mission[]>("/api/v1/missions") }),
  astronauts: (query: AstronautQuery) =>
    queryOptions({
      queryKey: queryKeys.astronauts(query),
      queryFn: () => api.get<PagedResult<AstronautSummary>>(withQuery("/api/v1/astronauts", query)),
    }),
  astronaut: (id: string) =>
    queryOptions({
      queryKey: queryKeys.astronaut(id),
      queryFn: () => api.get<AstronautDetail>(`/api/v1/astronauts/${id}`),
    }),
  /**
   * Recent raw readings for every streaming astronaut in ONE request — bootstraps the live
   * monitor buffers. SignalR keeps them current afterwards, so it never needs to refetch on its own.
   */
  telemetrySnapshot: () =>
    queryOptions({
      queryKey: queryKeys.telemetrySnapshot,
      queryFn: async () => {
        const snapshot = await api.get<TelemetrySnapshot>("/api/v1/telemetry/snapshot?minutes=10&perAstronaut=60");
        return new Map(snapshot.crew.map((c) => [c.astronautId, c.readings]));
      },
      staleTime: Infinity,
    }),
  thresholds: () =>
    queryOptions({
      queryKey: queryKeys.thresholds,
      queryFn: () => api.get<Threshold[]>("/api/v1/vitals/thresholds"),
      staleTime: Infinity,
    }),
  alerts: (query: AlertQuery) =>
    queryOptions({
      queryKey: queryKeys.alerts(query),
      queryFn: () => api.get<PagedResult<Alert>>(withQuery("/api/v1/alerts", query)),
    }),
  /** Fleet early-warning board, most at-risk first. Trends move slowly, so a 30s refresh is plenty. */
  fleetAssessments: () =>
    queryOptions({
      queryKey: queryKeys.assessments,
      queryFn: () => api.get<HealthAssessment[]>("/api/v1/assessments?windowMinutes=60"),
    }),
  /** Static reference data — fetched once per session. */
  earlyWarningScoring: () =>
    queryOptions({
      queryKey: queryKeys.earlyWarningScoring,
      queryFn: () => api.get<EarlyWarningScoring>("/api/v1/early-warning/scoring"),
      staleTime: Infinity,
    }),
  systemStatus: () =>
    queryOptions({
      queryKey: queryKeys.systemStatus,
      queryFn: () => api.get<SystemStatus>("/api/v1/system/status"),
    }),
};

// ---- Query hooks ---------------------------------------------------------

export const useDashboard = () => useQuery({ ...queries.dashboard(), refetchInterval: usePollFallback() });

export const useMissions = () => useQuery(queries.missions());

export const useAstronauts = (query: AstronautQuery) =>
  useQuery({ ...queries.astronauts(query), placeholderData: keepPreviousData, refetchInterval: usePollFallback() });

export const useAstronaut = (id: string) => useQuery({ ...queries.astronaut(id), refetchInterval: usePollFallback() });

export const useTelemetrySnapshot = () => useQuery(queries.telemetrySnapshot());

/** Server-side downsampled series for charts, independent of raw telemetry density. */
export const useVitalSeries = (id: string, hours: number, buckets = 240) =>
  useQuery({
    queryKey: queryKeys.vitalSeries(id, hours, buckets),
    queryFn: () => api.get<VitalSeries>(withQuery(`/api/v1/astronauts/${id}/vitals/series`, { hours, buckets })),
    placeholderData: keepPreviousData,
    refetchInterval: usePollFallback(),
  });

export const useVitalStats = (id: string, hours: number) =>
  useQuery({
    queryKey: queryKeys.vitalStats(id, hours),
    queryFn: () => api.get<VitalStats>(withQuery(`/api/v1/astronauts/${id}/vitals/stats`, { hours })),
  });

export const useThresholds = () => useQuery(queries.thresholds());

export const useAlerts = (query: AlertQuery) =>
  useQuery({ ...queries.alerts(query), placeholderData: keepPreviousData, refetchInterval: usePollFallback() });

export const useFleetAssessments = () =>
  useQuery({ ...queries.fleetAssessments(), refetchInterval: ASSESSMENT_REFRESH_MS });

export const useAssessment = (id: string) =>
  useQuery({
    queryKey: queryKeys.assessment(id),
    queryFn: () => api.get<HealthAssessment>(`/api/v1/astronauts/${id}/assessment?windowMinutes=60`),
    refetchInterval: ASSESSMENT_REFRESH_MS,
  });

export const useEarlyWarningScoring = () => useQuery(queries.earlyWarningScoring());

export const useSystemStatus = () => useQuery({ ...queries.systemStatus(), refetchInterval: 10_000 });

/** Readiness probe with client-measured round-trip time. */
export const useApiHealth = () =>
  useQuery({
    queryKey: queryKeys.apiHealth,
    queryFn: async () => {
      const started = performance.now();
      const response = await fetch(`${API_BASE_URL}/health/ready`, { cache: "no-store" });
      return { healthy: response.ok, status: await response.text(), latencyMs: Math.round(performance.now() - started) };
    },
    refetchInterval: 10_000,
    retry: false,
  });

// ---- Mutations -----------------------------------------------------------

export function useCreateMission() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMissionRequest) => api.post<Mission>("/api/v1/missions", body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.missions }),
  });
}

export function useChangeMissionStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: MissionStatus }) =>
      api.patch<Mission>(`/api/v1/missions/${id}/status`, { status }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.missions }),
        client.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]),
  });
}

export function useDeleteMission() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/missions/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.missions }),
  });
}

export function useCreateAstronaut() {
  const invalidate = useInvalidateHealth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertAstronautRequest) => api.post<AstronautDetail>("/api/v1/astronauts", body),
    onSuccess: () => Promise.all([invalidate(), client.invalidateQueries({ queryKey: queryKeys.missions })]),
  });
}

export function useDeleteAstronaut() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/astronauts/${id}`),
    onSuccess: invalidate,
  });
}

export function useRecordVitals(astronautId: string) {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (body: RecordVitalsRequest) =>
      api.post<RecordVitalsResponse>(`/api/v1/astronauts/${astronautId}/vitals`, body),
    onSuccess: invalidate,
  });
}

export function useAcknowledgeAlert() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (id: string) => api.post<Alert>(`/api/v1/alerts/${id}/acknowledge`),
    onSuccess: invalidate,
  });
}

export function useResolveAlert() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.post<Alert>(`/api/v1/alerts/${id}/resolve`, { note: note || null }),
    onSuccess: invalidate,
  });
}
