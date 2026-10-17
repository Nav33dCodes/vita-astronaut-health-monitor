"use client";

import { useSyncExternalStore } from "react";

// Persisted per-browser preference for audible critical-alert chimes.
const KEY = "vita:sound";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(KEY, enabled ? "on" : "off");
  } catch {
    // Storage unavailable (private mode) — preference just won't persist.
  }
  listeners.forEach((notify) => notify());
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    read,
    () => true,
  );
}

/** Plays a sequence of short tones via Web Audio — no asset download needed. */
function playTones(frequencies: number[], { step = 0.18, length = 0.16, volume = 0.12, wave = "sine" as OscillatorType } = {}) {
  if (!read()) return;
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    frequencies.forEach((frequency, i) => {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.value = frequency;
      osc.connect(gain);
      const start = ctx.currentTime + i * step;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      osc.start(start);
      osc.stop(start + length + 0.01);
    });
    setTimeout(() => ctx.close(), frequencies.length * step * 1000 + 400);
  } catch {
    // Audio is blocked until the user interacts with the page — ignore.
  }
}

/** Two-tone chime for a new critical alert. */
export const playAlertChime = () => playTones([880, 660]);

/** Harsher, repeating pattern reserved for escalations (master alarm). */
export const playMasterAlarm = () =>
  playTones([988, 740, 988, 740, 988, 740], { step: 0.22, length: 0.18, volume: 0.16, wave: "square" });
