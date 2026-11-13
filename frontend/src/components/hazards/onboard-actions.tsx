"use client";

import { ListChecks } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/primitives";
import { usePlaybook } from "@/lib/api/queries";
import { HAZARD_META } from "@/lib/hazards";
import { SkeletonText } from "@/components/ui/skeleton";

/** Numbered onboard first-response checklist for one alert type (playbook key = metric name). */
export function OnboardChecklist({ playbookKey }: { playbookKey: string }) {
  const playbook = usePlaybook();
  if (playbook.isPending) return <SkeletonText lines={5} />;

  const entry = playbook.data?.find((e) => e.key === playbookKey);
  if (!entry) return <p className="text-[13px] text-muted">No onboard checklist for this alert type.</p>;

  const meta = HAZARD_META[entry.hazard];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-panel-raised px-2 py-0.5 ring-1 ring-line ring-inset">
          <meta.icon className="size-3.5" aria-hidden /> {meta.label}
        </span>
        <span>NASA HRP risk: {entry.hrpRisk}</span>
      </div>
      <ol className="space-y-2">
        {entry.steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-[13.5px] text-ink">
            <span className="tnum grid size-5 shrink-0 place-items-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent">
              {i + 1}
            </span>
            <span className="pt-px">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[11.5px] text-faint">Illustrative first-response steps, not medical or flight procedures.</p>
    </div>
  );
}

/** Small button that opens the onboard checklist for an alert. */
export function OnboardActionsButton({ playbookKey, subject }: { playbookKey: string; subject: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton onClick={() => setOpen(true)} aria-label={`Onboard actions for ${subject}`} title="Onboard actions">
        <ListChecks />
      </IconButton>
      <Dialog open={open} onClose={() => setOpen(false)} title="Onboard actions" description={subject}>
        <OnboardChecklist playbookKey={playbookKey} />
      </Dialog>
    </>
  );
}
