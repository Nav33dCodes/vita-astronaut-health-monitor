"use client";

import clsx from "clsx";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { runReportJob, useActiveReports } from "@/lib/report-jobs";
import { Button } from "./primitives";

export interface ExportOption {
  label: string;
  description: string;
  format: "PDF" | "Excel";
  /** API path, e.g. /api/v1/reports/fleet.pdf */
  path: string;
  fallbackName: string;
}

const FORMAT_STYLE = {
  PDF: { icon: FileText, tile: "bg-critical/10 text-critical", badge: "border-critical/30 text-critical" },
  Excel: { icon: FileSpreadsheet, tile: "bg-nominal/10 text-nominal", badge: "border-nominal/30 text-nominal" },
} as const;

/** Minimal dropdown that starts server-side report jobs; progress lives in a toast, so the UI stays free. */
export function ExportMenu({ options, label = "Export" }: { options: ExportOption[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const active = useActiveReports();
  const runningHere = options.filter((o) => active.has(`report:${o.path}`)).length;
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (option: ExportOption) => {
    setOpen(false);
    void runReportJob(option);
  };

  return (
    <div ref={root} className="relative">
      <Button
        variant="secondary"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        {runningHere > 0 ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
        {runningHere > 0 ? `Generating${runningHere > 1 ? ` (${runningHere})` : ""}…` : label}
        <ChevronDown className={clsx("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </Button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="glass glass-blur absolute right-0 z-30 mt-2 w-80 origin-top-right animate-page-in rounded-2xl p-1.5 shadow-[0_24px_48px_-20px_rgb(0_0_0/0.45)]"
        >
          <p className="hud-label px-3 pt-2 pb-1.5 !text-[9px]">Generate report</p>
          {options.map((option) => {
            const style = FORMAT_STYLE[option.format];
            const running = active.has(`report:${option.path}`);
            return (
              <button
                key={option.path}
                role="menuitem"
                onClick={() => run(option)}
                disabled={running}
                aria-busy={running}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-overlay/[0.05] focus-visible:bg-overlay/[0.05] focus-visible:outline-none disabled:cursor-progress disabled:opacity-60"
              >
                <span className={clsx("grid size-9 shrink-0 place-items-center rounded-lg", style.tile)}>
                  {running ? <Loader2 className="size-4.5 animate-spin" aria-hidden /> : <style.icon className="size-4.5" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{option.label}</span>
                    <span className={clsx("rounded border px-1 font-mono text-[9px] font-semibold", style.badge)}>{option.format}</span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted">{running ? "Generating… progress is shown in the notification" : option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
