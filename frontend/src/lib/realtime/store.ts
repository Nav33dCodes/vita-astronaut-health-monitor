"use client";

import { useSyncExternalStore } from "react";
import type { Alert, HabitatReading, VitalReading } from "@/lib/api/types";

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

/*
 * Telemetry arrives in bursts (every crew member and the cabin within a few milliseconds).
 * Stores update their value immediately but notify subscribers once per burst, so a burst of
 * five packets costs one render instead of five.
 */
const BATCH_MS = 32;
const dirty = new Set<() => void>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleNotify(notifyAll: () => void) {
  dirty.add(notifyAll);
  flushTimer ??= setTimeout(() => {
    flushTimer = null;
    const pending = [...dirty];
    dirty.clear();
    pending.forEach((notify) => notify());
  }, BATCH_MS);
}

function createStore<T>(initial: T, { batched = false } = {}) {
  let value = initial;
  const listeners = new Set<() => void>();
  const notifyAll = () => listeners.forEach((notify) => notify());
  return {
    get: () => value,
    set(next: T) {
      value = next;
      if (batched) scheduleNotify(notifyAll);
      else notifyAll();
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
export const eventStore = createStore<TelemetryEvent[]>([], { batched: true });
export const liveStore = createStore<Record<string, VitalReading[]>>({}, { batched: true });

/** Cabin environment pushed over SignalR, per mission (last MAX_HABITAT_READINGS). */
export const habitatStore = createStore<Record<string, HabitatReading[]>>({}, { batched: true });
const MAX_HABITAT_READINGS = 180;

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

export function recordHabitat(reading: HabitatReading) {
  const all = habitatStore.get();
  const next = [...(all[reading.missionId] ?? []), reading];
  habitatStore.set({ ...all, [reading.missionId]: next.length > MAX_HABITAT_READINGS ? next.slice(-MAX_HABITAT_READINGS) : next });
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

// ---- Event rate (events in the trailing minute) ----------------------------------------------
// Derived once for the whole app and published only when the number changes, so components
// showing "24/min" don't re-render on every packet.

const rateStore = createStore(0);
let rateTimer: ReturnType<typeof setInterval> | null = null;
let rateSubscribers = 0;

function recomputeRate() {
  const cutoff = Date.now() - 60_000;
  let count = 0;
  for (const event of eventStore.get()) {
    if (event.at < cutoff) break; // newest first
    count++;
  }
  if (count !== rateStore.get()) rateStore.set(count);
}

function subscribeRate(notify: () => void) {
  const unsubscribe = rateStore.subscribe(notify);
  const unsubscribeEvents = eventStore.subscribe(recomputeRate);
  if (rateSubscribers++ === 0) {
    recomputeRate();
    rateTimer = setInterval(recomputeRate, 2_000); // lets the rate decay when the stream goes quiet
  }
  return () => {
    unsubscribe();
    unsubscribeEvents();
    if (--rateSubscribers === 0 && rateTimer) {
      clearInterval(rateTimer);
      rateTimer = null;
    }
  };
}

/** Events per minute over the trailing minute. */
export const useEventRate = () => useSyncExternalStore(subscribeRate, rateStore.get, () => 0);

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

const NO_LIVE: Record<string, VitalReading[]> = {};
/** Every astronaut's SignalR readings since the page loaded, keyed by astronaut id. */
export const useAllLiveReadings = () => useSyncExternalStore(liveStore.subscribe, liveStore.get, () => NO_LIVE);

const NO_HABITAT: HabitatReading[] = [];
/** Live cabin readings for one mission since the page loaded. */
export const useLiveHabitat = (missionId: string) =>
  useSyncExternalStore(
    habitatStore.subscribe,
    () => habitatStore.get()[missionId] ?? NO_HABITAT,
    () => NO_HABITAT,
  );

const NO_ALARMS: Alert[] = [];
export const useAlarms = () => useSyncExternalStore(alarmStore.subscribe, alarmStore.get, () => NO_ALARMS);
