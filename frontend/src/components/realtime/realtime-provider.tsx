"use client";

import { HttpTransportType, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { API_BASE_URL } from "@/lib/api/client";
import type { Alert, AstronautDetail, HabitatUpdatedEvent, HealthStatus, ReadingRecordedEvent } from "@/lib/api/types";
import { showDesktopAlert } from "@/lib/notifications";
import { getNotificationMode, notify } from "@/lib/notify";
import { clearAlarm, raiseAlarm, recordEvent, recordHabitat, recordLiveReading, updateLink } from "@/lib/realtime/store";
import { playAlertChime, playMasterAlarm } from "@/lib/sound";

const HUB_URL = `${API_BASE_URL}/hubs/telemetry`;
const RETRY_DELAYS_MS = [0, 1_000, 3_000, 5_000, 10_000, 20_000, 30_000];
const PING_INTERVAL_MS = 10_000;

/**
 * Coalesces cache invalidations: telemetry arrives in bursts, and refetching on every
 * packet would hammer the API. Keys are flushed together after `delayMs`.
 */
function createInvalidator(client: QueryClient, delayMs: number) {
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule(keys: string[]) {
      keys.forEach((key) => pending.add(key));
      timer ??= setTimeout(() => {
        pending.forEach((key) => client.invalidateQueries({ queryKey: [key] }));
        pending.clear();
        timer = null;
      }, delayMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
    },
  };
}

/** Owns the SignalR connection for the app's lifetime and routes events into caches and stores. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, { transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => RETRY_DELAYS_MS[Math.min(ctx.previousRetryCount, RETRY_DELAYS_MS.length - 1)] })
      .configureLogging(LogLevel.Warning)
      .build();

    const telemetryRefresh = createInvalidator(client, 4_000);
    const alertRefresh = createInvalidator(client, 300);
    const hazardRefresh = createInvalidator(client, 2_000);
    // Desktop notifications follow the same quiet rules: none when notifications are muted.
    const desktop = (title: string, body: string, tag: string, href: string) => {
      if (getNotificationMode() === "mute") return;
      showDesktopAlert({ title, body, tag, sticky: true, onClick: () => router.push(href) });
    };
    // Last known cabin status per mission: notify only when it gets worse, never on every packet.
    const habitatStatus = new Map<string, HealthStatus>();
    const rank: Record<HealthStatus, number> = { Unknown: 0, Nominal: 1, Caution: 2, Critical: 3 };
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const markConnected = () =>
      updateLink({
        state: "connected",
        connectionId: connection.connectionId,
        transport: "WebSockets",
        connectedAt: Date.now(),
      });

    connection.on("ReadingRecorded", (event: ReadingRecordedEvent) => {
      const { reading, astronautName } = event;
      recordLiveReading(reading);
      recordEvent({ kind: "reading", astronautId: reading.astronautId, astronautName, reading });
      client.setQueryData<AstronautDetail>(["astronaut", reading.astronautId], (old) =>
        old ? { ...old, latestReading: reading } : old,
      );
      telemetryRefresh.schedule(["dashboard", "astronauts", "vital-stats", "vital-series"]);
    });

    connection.on("HabitatUpdated", ({ reading, missionName }: HabitatUpdatedEvent) => {
      recordHabitat(reading);
      const previous = habitatStatus.get(reading.missionId) ?? "Nominal";
      habitatStatus.set(reading.missionId, reading.status);
      if (rank[reading.status] !== rank[previous]) hazardRefresh.schedule(["hazards"]);
      if (rank[reading.status] <= rank[previous] || reading.findings.length === 0) return;

      const worst = [...reading.findings].sort((a, b) => rank[b.status] - rank[a.status])[0];
      const critical = reading.status === "Critical";
      notify({
        severity: critical ? "critical" : "warning",
        title: `${missionName} cabin`,
        body: worst.message,
        href: "/hazards",
        group: `habitat:${reading.missionId}`,
        groupNoun: "cabin updates",
        onOpen: () => router.push("/hazards"),
      });
      if (critical) {
        playAlertChime();
        desktop(`Cabin · ${missionName}`, worst.message, `habitat-${reading.missionId}`, "/hazards");
      }
    });

    connection.on("AlertRaised", (alert: Alert) => {
      recordEvent({ kind: "alert-raised", astronautId: alert.astronautId, astronautName: alert.astronautName, alert });
      alertRefresh.schedule(["alerts", "dashboard", "astronauts", "astronaut"]);

      const critical = alert.severity === "Critical";
      notify({
        severity: critical ? "critical" : "warning",
        title: alert.astronautName,
        body: alert.message,
        href: `/crew/${alert.astronautId}`,
        group: `crew:${alert.astronautId}`,
        groupNoun: "new alerts",
        onOpen: () => router.push(`/crew/${alert.astronautId}`),
      });
      if (critical) {
        playAlertChime();
        desktop(`Critical · ${alert.astronautName}`, alert.message, alert.id, `/crew/${alert.astronautId}`);
      }
    });

    connection.on("AlertEscalated", (alert: Alert) => {
      recordEvent({ kind: "alert-escalated", astronautId: alert.astronautId, astronautName: alert.astronautName, alert });
      alertRefresh.schedule(["alerts", "dashboard", "astronauts", "astronaut"]);
      raiseAlarm(alert);
      playMasterAlarm();
      // The full-screen master alarm is the notification; the inbox keeps the record.
      notify({
        severity: "critical",
        title: `Escalated · ${alert.astronautName}`,
        body: `${alert.message}. Unacknowledged, level ${alert.escalationLevel}.`,
        href: "/alerts",
        group: `escalation:${alert.id}`,
      });
      desktop(`Master alarm · ${alert.astronautName}`, `${alert.message}. Still unacknowledged.`, `escalation-${alert.id}`, "/alerts");
    });

    connection.on("AlertUpdated", (alert: Alert) => {
      if (alert.status !== "Open") clearAlarm(alert.id);
      recordEvent({ kind: "alert-updated", astronautId: alert.astronautId, astronautName: alert.astronautName, alert });
      alertRefresh.schedule(["alerts", "dashboard", "astronauts", "astronaut"]);
    });

    let reconnects = 0;
    connection.onreconnecting(() => updateLink({ state: "reconnecting", latencyMs: null, reconnects: ++reconnects }));
    connection.onreconnected(() => {
      markConnected();
      // Anything missed while offline is recovered by refetching.
      client.invalidateQueries();
    });
    connection.onclose(() => {
      if (disposed) return;
      updateLink({ state: "disconnected", latencyMs: null, connectionId: null });
      scheduleStart(10_000);
    });

    const start = async () => {
      if (disposed) return;
      updateLink({ state: "connecting" });
      try {
        await connection.start();
        if (disposed) return void connection.stop();
        markConnected();
      } catch {
        if (disposed) return;
        updateLink({ state: "disconnected" });
        scheduleStart(5_000);
      }
    };

    // Automatic reconnect gives up eventually (and doesn't cover the first start) — keep retrying.
    const scheduleStart = (delay: number) => {
      retryTimer = setTimeout(() => {
        updateLink({ reconnects: ++reconnects });
        void start();
      }, delay);
    };

    const ping = setInterval(async () => {
      if (connection.state !== HubConnectionState.Connected) return;
      const started = performance.now();
      try {
        await connection.invoke("Ping");
        updateLink({ latencyMs: Math.round(performance.now() - started) });
      } catch {
        updateLink({ latencyMs: null });
      }
    }, PING_INTERVAL_MS);

    // Deferred one tick: React StrictMode mounts effects twice in development, and the first
    // mount is torn down immediately — this keeps it from opening a connection at all.
    const startTimer = setTimeout(() => void start(), 0);

    return () => {
      disposed = true;
      clearTimeout(startTimer);
      clearInterval(ping);
      if (retryTimer) clearTimeout(retryTimer);
      telemetryRefresh.cancel();
      alertRefresh.cancel();
      hazardRefresh.cancel();
      void connection.stop();
    };
  }, [client, router]);

  return <>{children}</>;
}
