"use client";

import { Siren, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EscalationBadge } from "@/components/ui/ews";
import { Button } from "@/components/ui/primitives";
import { useAcknowledgeAlert } from "@/lib/api/queries";
import { dismissAlarms, useAlarms } from "@/lib/realtime/store";
import { timeAgo } from "@/lib/format";

/**
 * Full-screen master alarm, raised when an alert escalates because nobody acknowledged it.
 * The one place the UI is deliberately loud: it blocks the screen until the operator acts.
 */
export function MasterAlarm() {
  const alarms = useAlarms();
  const router = useRouter();
  const acknowledge = useAcknowledgeAlert();
  const [busy, setBusy] = useState(false);
  const primary = useRef<HTMLButtonElement>(null);

  const open = alarms.length > 0;

  useEffect(() => {
    if (open) primary.current?.focus();
  }, [open]);

  if (!open) return null;

  const acknowledgeAll = async () => {
    setBusy(true);
    const results = await Promise.allSettled(alarms.map((a) => acknowledge.mutateAsync(a.id)));
    setBusy(false);
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      toast.error(`${failed} alert(s) could not be acknowledged`, { description: "They may already be handled." });
    } else {
      toast.success(`${alarms.length} escalated alert${alarms.length > 1 ? "s" : ""} acknowledged`);
    }
    dismissAlarms();
  };

  return (
    <div className="fixed inset-0 z-50 grid animate-fade-in place-items-center bg-scrim p-4" role="presentation">
      {/* Red frame around the viewport: unmistakable, but not a strobe. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 animate-blink border-4 border-critical-solid" />

      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="master-alarm-title"
        aria-describedby="master-alarm-body"
        className="surface-pop relative w-[min(34rem,100%)] animate-pop-in overflow-hidden rounded-xl"
      >
        <div className="flex items-center gap-3 bg-critical-solid px-5 py-4 text-white">
          <Siren className="size-5 shrink-0" aria-hidden />
          <div>
            <p className="text-[12px] font-medium text-white/80">Master alarm</p>
            <h2 id="master-alarm-title" className="text-[15px] font-semibold">
              {alarms.length} alert{alarms.length > 1 ? "s" : ""} escalated without acknowledgement
            </h2>
          </div>
        </div>

        <ul id="master-alarm-body" className="max-h-72 divide-y divide-line overflow-y-auto px-5">
          {alarms.map((a) => (
            <li key={a.id} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13.5px] font-medium text-ink">{a.astronautName}</p>
                <EscalationBadge level={a.escalationLevel} />
              </div>
              <p className="mt-0.5 text-[13px] text-muted">{a.message}</p>
              <p className="mt-0.5 text-[12px] text-faint">
                {a.severity} · raised {timeAgo(a.raisedAtUtc)}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-canvas px-5 py-3.5">
          <Button variant="ghost" onClick={dismissAlarms} title="Hide this popup; alerts stay open and keep escalating">
            <VolumeX className="size-4" aria-hidden /> Silence
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              dismissAlarms();
              router.push("/alerts");
            }}
          >
            Open alerts
          </Button>
          <Button ref={primary} loading={busy} onClick={acknowledgeAll} className="!bg-critical-solid hover:!opacity-90">
            Acknowledge all
          </Button>
        </div>
      </section>
    </div>
  );
}
