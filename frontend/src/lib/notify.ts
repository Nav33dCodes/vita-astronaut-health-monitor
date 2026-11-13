"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";

/*
 * One place that decides how loud an event is.
 *
 *   inbox  every operational event is kept here, quietly (bell → notification panel)
 *   toast  only what needs a decision now: critical events, plus warnings in "All" mode
 *   mute   nothing pops up; the inbox still fills (escalations still take over the screen)
 *
 * Toasts for the same subject within a minute are merged ("Daniel Reyes · 3 critical alerts")
 * instead of stacking.
 */

export type NotificationSeverity = "critical" | "warning" | "info";
export type NotificationMode = "critical" | "all" | "mute";

export interface InboxItem {
  id: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  href?: string;
  at: number;
  read: boolean;
}

const INBOX_KEY = "vita:inbox";
const MODE_KEY = "vita:notify-mode";
const MAX_ITEMS = 100;
const GROUP_WINDOW_MS = 60_000;

// ---- Tiny external store -----------------------------------------------------------------

type Listener = () => void;

function createStore<T>(load: () => T, save: (value: T) => void) {
  let value: T | undefined;
  const listeners = new Set<Listener>();
  const get = () => (value ??= load());
  return {
    get,
    set(next: T) {
      value = next;
      save(next);
      listeners.forEach((l) => l());
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the inbox still works for this session.
  }
}

const EMPTY: InboxItem[] = [];
const inbox = createStore<InboxItem[]>(
  () => (typeof window === "undefined" ? EMPTY : readJson<InboxItem[]>(INBOX_KEY, EMPTY)),
  (items) => writeJson(INBOX_KEY, items),
);

const mode = createStore<NotificationMode>(
  () => {
    if (typeof window === "undefined") return "critical";
    const stored = readJson<string>(MODE_KEY, "critical");
    return stored === "all" || stored === "mute" ? stored : "critical";
  },
  (value) => writeJson(MODE_KEY, value),
);

// ---- Hooks -------------------------------------------------------------------------------

export const useInbox = () => useSyncExternalStore(inbox.subscribe, inbox.get, () => EMPTY);

export const useUnread = () => {
  const items = useInbox();
  let count = 0;
  let critical = false;
  for (const item of items) {
    if (item.read) continue;
    count++;
    if (item.severity === "critical") critical = true;
  }
  return { count, critical };
};

export const useNotificationMode = () => useSyncExternalStore(mode.subscribe, mode.get, () => "critical" as NotificationMode);

export const setNotificationMode = (value: NotificationMode) => mode.set(value);
export const getNotificationMode = () => mode.get();

export const markRead = (id: string) => inbox.set(inbox.get().map((i) => (i.id === id ? { ...i, read: true } : i)));
export const markAllRead = () => inbox.set(inbox.get().map((i) => (i.read ? i : { ...i, read: true })));
export const clearInbox = () => inbox.set([]);

// ---- Publishing ----------------------------------------------------------------------------

let sequence = 0;
const recentGroups = new Map<string, { count: number; at: number }>();

interface NotifyOptions {
  severity: NotificationSeverity;
  title: string;
  body: string;
  href?: string;
  /** Events with the same group key within a minute share one toast. */
  group?: string;
  /** Plural noun for the merged toast, e.g. "critical alerts". */
  groupNoun?: string;
  onOpen?: () => void;
}

/** Records an operational event and, if it warrants it, shows one compact toast. */
export function notify({ severity, title, body, href, group, groupNoun = "updates", onOpen }: NotifyOptions) {
  const item: InboxItem = { id: `${Date.now().toString(36)}-${(sequence++).toString(36)}`, severity, title, body, href, at: Date.now(), read: false };
  inbox.set([item, ...inbox.get()].slice(0, MAX_ITEMS));

  const current = mode.get();
  const loud = current !== "mute" && (severity === "critical" || (severity === "warning" && current === "all"));
  if (!loud) return;

  const show = severity === "critical" ? toast.error : severity === "warning" ? toast.warning : toast.info;
  const action = onOpen ? { label: "View", onClick: onOpen } : undefined;

  if (!group) {
    show(title, { description: body, action, duration: severity === "critical" ? 8_000 : 4_000 });
    return;
  }

  // Merge bursts about the same subject into a single toast.
  const now = Date.now();
  const previous = recentGroups.get(group);
  const count = previous && now - previous.at < GROUP_WINDOW_MS ? previous.count + 1 : 1;
  recentGroups.set(group, { count, at: now });

  show(count > 1 ? `${title.split(" · ")[0]} · ${count} ${groupNoun}` : title, {
    id: `group:${group}`,
    description: body,
    action,
    duration: severity === "critical" ? 8_000 : 4_000,
  });
}

/** Feedback for something the user just did: short, quiet, never stored in the inbox. */
export const confirm = {
  done: (message: string) => toast.success(message, { duration: 2_500 }),
  failed: (message: string, reason?: string) => toast.error(message, { description: reason, duration: 5_000 }),
};
