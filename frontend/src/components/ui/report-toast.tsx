"use client";

import clsx from "clsx";
import { CircleCheck, ExternalLink, FileSpreadsheet, FileText, OctagonAlert, RotateCcw, X } from "lucide-react";
import { useNow } from "@/lib/time";
import type { ExportOption } from "./export-menu";

export type ReportJobState =
  | { phase: "generating" }
  | { phase: "downloading"; progress: number }
  | { phase: "ready"; fileName: string; sizeBytes: number; url: string; seconds: number }
  | { phase: "failed"; message: string }
  | { phase: "cancelled" };

const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const ACTION =
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

interface ReportToastProps {
  option: ExportOption;
  state: ReportJobState;
  startedAt: number;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

/** Live status card for one report job, rendered inside the themed toast shell. */
export function ReportToast({ option, state, startedAt, onCancel, onRetry, onDismiss }: ReportToastProps) {
  const now = useNow(1000);
  const elapsed = now ? Math.max(0, Math.round((now.getTime() - startedAt) / 1000)) : 0;
  const busy = state.phase === "generating" || state.phase === "downloading";
  const FormatIcon = option.format === "PDF" ? FileText : FileSpreadsheet;

  const icon =
    state.phase === "ready" ? (
      <CircleCheck className="size-4" aria-hidden />
    ) : state.phase === "failed" ? (
      <OctagonAlert className="size-4" aria-hidden />
    ) : (
      <FormatIcon className="size-4" aria-hidden />
    );

  const status = (() => {
    switch (state.phase) {
      case "generating":
        return elapsed >= 8
          ? `Building ${option.format} on the server… ${elapsed}s — larger reports take a moment`
          : `Building ${option.format} on the server… ${elapsed}s`;
      case "downloading":
        return `Downloading · ${Math.round(state.progress * 100)}%`;
      case "ready":
        return `${state.fileName} · ${formatBytes(state.sizeBytes)} · ${state.seconds.toFixed(1)}s`;
      case "failed":
        return state.message;
      case "cancelled":
        return "Generation cancelled";
    }
  })();

  const title =
    state.phase === "ready" ? `${option.label} ready` : state.phase === "failed" ? "Export failed" : option.label;

  return (
    <div className="flex w-full items-start gap-3" role="status" aria-live="polite">
      <span
        className={clsx(
          "relative grid size-8 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--toast-accent)_13%,transparent)] text-[var(--toast-accent)]",
          busy && "after:absolute after:inset-0 after:animate-ping after:rounded-xl after:bg-[var(--toast-accent)] after:opacity-10",
        )}
      >
        {icon}
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] leading-snug font-semibold tracking-tight text-ink">{title}</p>
          <span className="rounded border border-line-strong px-1 font-mono text-[9px] font-semibold text-muted">{option.format}</span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-relaxed text-muted" title={status}>
          {status}
        </p>

        {busy && (
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-overlay/[0.07]" aria-hidden>
            {state.phase === "downloading" ? (
              <div
                className="h-full rounded-full bg-[var(--toast-accent)] transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(state.progress * 100, 4)}%` }}
              />
            ) : (
              <div className="h-full w-1/3 animate-indeterminate rounded-full bg-[var(--toast-accent)]" />
            )}
          </div>
        )}

        <div className="mt-2.5 flex items-center gap-1.5 empty:hidden">
          {busy && (
            <button onClick={onCancel} className={clsx(ACTION, "text-muted hover:bg-overlay/[0.06] hover:text-ink")}>
              Cancel
            </button>
          )}
          {state.phase === "ready" && option.format === "PDF" && (
            <a
              href={state.url}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(ACTION, "bg-[color-mix(in_srgb,var(--toast-accent)_14%,transparent)] text-[var(--toast-accent)] hover:bg-[color-mix(in_srgb,var(--toast-accent)_24%,transparent)]")}
            >
              <ExternalLink className="size-3.5" aria-hidden /> Open
            </a>
          )}
          {state.phase === "failed" && (
            <button
              onClick={onRetry}
              className={clsx(ACTION, "bg-[color-mix(in_srgb,var(--toast-accent)_14%,transparent)] text-[var(--toast-accent)] hover:bg-[color-mix(in_srgb,var(--toast-accent)_24%,transparent)]")}
            >
              <RotateCcw className="size-3.5" aria-hidden /> Retry
            </button>
          )}
        </div>
      </div>

      {!busy && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mt-1 -mr-5 grid size-6 shrink-0 place-items-center rounded-lg text-faint transition hover:bg-overlay/[0.06] hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
