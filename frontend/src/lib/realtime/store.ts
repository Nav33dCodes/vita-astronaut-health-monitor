"use client";

import { useSyncExternalStore } from "react";
import type { Alert, VitalReading } from "@/lib/api/types";

/*
 * Client-side real-time state, fed by the SignalR connection.
 * Plain external stores (no context) so any component can subscribe cheaply.
 */

export type LinkState = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface LinkStatus {
  state: LinkState;
  connectionId: string | null;
  transport: string | null;
  connectedAt: number | null;
  reconnects: number;
  latencyMs: number | null;
}

export type TelemetryEvent =
  | { id: string; at: number; kind: "reading"; astronautId: string; astronautName: string; reading: VitalReading }
  | { id: string; at: number; kind: "alert-raised"; astronautId: string; astronautName: string; alert: Alert }
  | { id: string; at: number; kind: "alert-updated"; astronautId: string; astronautName: string; alert: Alert }
  | { id: string; at: number; kind: "alert-escalated"; astronautId: string; astronautName: string; alert: Alert };

export const MAX_EVENTS = 600;
const MAX_LIVE_READINGS = 120;

function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      listeners.forEach((notify) => notify());
    },
    subscribe(notify: () => void) {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
  };
}

const INITIAL_STATUS: LinkStatus = {
  state: "connecting",
  connectionId: null,
  transport: null,
  connectedAt: null,
  reconnects: 0,
  latencyMs: null,
};

export const linkStore = createStore<LinkStatus>(INITIAL_STATUS);
export const eventStore = createStore<TelemetryEvent[]>([]);
export const liveStore = createStore<Record<string, VitalReading[]>>({});

/** Escalated alerts waiting for the operator to deal with the master-alarm popup. */
export const alarmStore = createStore<Alert[]>([]);

let sequence = 0;
const nextId = () => `${Date.now().toString(36)}-${(sequence++).toString(36)}`;

export function updateLink(patch: Partial<LinkStatus>) {
  linkStore.set({ ...linkStore.get(), ...patch });
}

/** Omit that distributes over each member of a union. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function recordEvent(event: DistributiveOmit<TelemetryEvent, "id" | "at">) {
  const entry = { ...event, id: nextId(), at: Date.now() } as TelemetryEvent;
  const events = eventStore.get();
  eventStore.set(events.length >= MAX_EVENTS ? [entry, ...events.slice(0, MAX_EVENTS - 1)] : [entry, ...events]);
}

export function clearEvents() {
  eventStore.set([]);
}

export function recordLiveReading(reading: VitalReading) {
  const all = liveStore.get();
  const existing = all[reading.astronautId] ?? [];
  const next = [...existing, reading];
  liveStore.set({ ...all, [reading.astronautId]: next.length > MAX_LIVE_READINGS ? next.slice(-MAX_LIVE_READINGS) : next });
}

export function raiseAlarm(alert: Alert) {
  alarmStore.set([alert, ...alarmStore.get().filter((a) => a.id !== alert.id)]);
}

/** Drops alarms for alerts that are no longer open (acknowledged/resolved anywhere). */
export function clearAlarm(alertId: string) {
  const current = alarmStore.get();
  if (current.some((a) => a.id === alertId)) alarmStore.set(current.filter((a) => a.id !== alertId));
}

export function dismissAlarms() {
  alarmStore.set([]);
}

// ---- Hooks ---------------------------------------------------------------

export const useLinkStatus = () => useSyncExternalStore(linkStore.subscribe, linkStore.get, () => INITIAL_STATUS);

export const useIsLive = () => useLinkStatus().state === "connected";

const EMPTY_EVENTS: TelemetryEvent[] = [];
export const useEventLog = () => useSyncExternalStore(eventStore.subscribe, eventStore.get, () => EMPTY_EVENTS);

const EMPTY_READINGS: VitalReading[] = [];
/** Readings received over SignalR for one astronaut since the page loaded. */
export const useLiveReadings = (astronautId: string) =>
  useSyncExternalStore(
    liveStore.subscribe,
    () => liveStore.get()[astronautId] ?? EMPTY_READINGS,
    () => EMPTY_READINGS,
  );

const NO_ALARMS: Alert[] = [];
export const useAlarms = () => useSyncExternalStore(alarmStore.subscribe, alarmStore.get, () => NO_ALARMS);
