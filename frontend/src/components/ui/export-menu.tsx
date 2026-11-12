"use client";

import clsx from "clsx";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { runReportJob, useActiveReports } from "@/lib/report-jobs";
import { MenuLabel, Popover } from "./popover";
import { Button } from "./primitives";

export interface ExportOption {
  label: string;
  description: string;
  format: "PDF" | "Excel";
  /** API path, e.g. /api/v1/reports/fleet.pdf */
  path: string;
  fallbackName: string;
}

const FORMAT_ICON = { PDF: FileText, Excel: FileSpreadsheet } as const;

/** Dropdown that starts server-side report jobs; progress lives in a toast, so the UI stays free. */
export function ExportMenu({ options, label = "Export" }: { options: ExportOption[]; label?: string }) {
  const active = useActiveReports();
  const runningHere = options.filter((o) => active.has(`report:${o.path}`)).length;

  return (
    <Popover
      width="20rem"
      trigger={({ toggle, ...aria }) => (
        <Button variant="secondary" onClick={toggle} aria-haspopup="menu" {...aria}>
          {runningHere > 0 ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
          <span className="hidden sm:inline">{runningHere > 0 ? `Generating${runningHere > 1 ? ` (${runningHere})` : ""}…` : label}</span>
          <ChevronDown className={clsx("size-3.5 text-muted transition-transform", aria["aria-expanded"] && "rotate-180")} aria-hidden />
        </Button>
      )}
    >
      {(close) => (
        <div role="menu">
          <MenuLabel>Generate report</MenuLabel>
          {options.map((option) => {
            const Icon = FORMAT_ICON[option.format];
            const running = active.has(`report:${option.path}`);
            return (
              <button
                key={option.path}
                role="menuitem"
                onClick={() => {
                  close();
                  void runReportJob(option);
                }}
                disabled={running}
                aria-busy={running}
                className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-overlay/[0.05] focus-visible:bg-overlay/[0.05] focus-visible:outline-none disabled:cursor-progress disabled:opacity-60"
              >
                <span className="mt-px grid size-8 shrink-0 place-items-center rounded-lg bg-panel-raised text-muted ring-1 ring-line ring-inset">
                  {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">{option.label}</span>
                    <span className="text-[11px] font-medium text-faint">{option.format === "PDF" ? ".pdf" : ".xlsx"}</span>
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted">
                    {running ? "Generating… progress shows in the notification" : option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
