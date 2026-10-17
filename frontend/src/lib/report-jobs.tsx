"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { ExportOption } from "@/components/ui/export-menu";
import { ReportToast, type ReportJobState } from "@/components/ui/report-toast";
import { API_BASE_URL, ApiError } from "./api/client";

/*
 * Report generation as background "jobs": each one owns a live toast (generating → downloading
 * with real progress → ready / failed / cancelled), survives page navigation, can be cancelled,
 * and never runs twice for the same report at once.
 */

const active = new Map<string, AbortController>();
const listeners = new Set<() => void>();
let snapshot: ReadonlySet<string> = new Set();

function publish() {
  snapshot = new Set(active.keys());
  listeners.forEach((notify) => notify());
}

/** Paths of reports currently being generated — lets menus show per-item progress. */
export function useActiveReports(): ReadonlySet<string> {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => snapshot,
    () => snapshot,
  );
}

function fileNameFrom(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encoded) return decodeURIComponent(encoded[1]);
  return /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? fallback;
}

/** Streams the body so the toast can show real download progress when the size is known. */
async function readWithProgress(response: Response, onProgress: (ratio: number) => void): Promise<Blob> {
  const total = Number(response.headers.get("Content-Length")) || 0;
  if (!response.body || total === 0) return response.blob();

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(Math.min(received / total, 1));
  }
  return new Blob(chunks, { type: response.headers.get("Content-Type") ?? undefined });
}

function saveBlob(blob: Blob, name: string): string {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Kept alive for a while so "Open" can preview the PDF without downloading it again.
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  return url;
}

export async function runReportJob(option: ExportOption): Promise<void> {
  const id = `report:${option.path}`;
  if (active.has(id)) {
    toast.info(`${option.label} is already being generated`);
    return;
  }

  const controller = new AbortController();
  active.set(id, controller);
  publish();

  const startedAt = Date.now();
  const show = (state: ReportJobState, duration = Infinity) =>
    toast.custom(
      () => (
        <ReportToast
          option={option}
          state={state}
          startedAt={startedAt}
          onCancel={() => controller.abort()}
          onRetry={() => void runReportJob(option)}
          onDismiss={() => toast.dismiss(id)}
        />
      ),
      { id, duration, className: `report-toast-${state.phase}` },
    );

  show({ phase: "generating" });

  try {
    const response = await fetch(`${API_BASE_URL}${option.path}`, { signal: controller.signal });
    if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => ({})));

    show({ phase: "downloading", progress: 0 });
    let lastShown = 0;
    const blob = await readWithProgress(response, (ratio) => {
      // Throttle toast updates to visible steps.
      if (ratio - lastShown >= 0.05 || ratio === 1) {
        lastShown = ratio;
        show({ phase: "downloading", progress: ratio });
      }
    });

    const name = fileNameFrom(response.headers.get("Content-Disposition"), option.fallbackName);
    const url = saveBlob(blob, name);
    show({ phase: "ready", fileName: name, sizeBytes: blob.size, url, seconds: (Date.now() - startedAt) / 1000 }, 8_000);
  } catch (error) {
    if (controller.signal.aborted) {
      show({ phase: "cancelled" }, 3_000);
    } else {
      show({ phase: "failed", message: error instanceof Error ? error.message : "Unexpected error" }, 10_000);
    }
  } finally {
    active.delete(id);
    publish();
  }
}
