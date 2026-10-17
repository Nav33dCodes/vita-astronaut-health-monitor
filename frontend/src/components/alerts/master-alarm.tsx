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
 * Deliberately hard to ignore: it blocks the UI until the operator acts.
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-critical/15 p-4 backdrop-blur-sm" role="presentation">
      {/* Pulsing red frame around the whole viewport */}
      <div aria-hidden className="pointer-events-none fixed inset-0 animate-blink border-[6px] border-critical/70" />

      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="master-alarm-title"
        aria-describedby="master-alarm-body"
        className="glass glass-blur glow-critical relative w-[min(36rem,100%)] animate-fade-up rounded-2xl p-6"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl bg-critical text-white shadow-[0_0_24px_var(--color-critical)]">
            <Siren className="size-6 animate-heartbeat" aria-hidden />
          </span>
          <div>
            <p className="hud-label !text-critical">Master alarm</p>
            <h2 id="master-alarm-title" className="text-xl font-semibold text-ink">
              {alarms.length} alert{alarms.length > 1 ? "s" : ""} escalated — no acknowledgement
            </h2>
          </div>
        </div>

        <ul id="master-alarm-body" className="mt-5 max-h-64 space-y-2 overflow-y-auto">
          {alarms.map((a) => (
            <li key={a.id} className="rounded-xl border border-critical/30 bg-critical/[0.07] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">{a.astronautName}</p>
                <EscalationBadge level={a.escalationLevel} />
              </div>
              <p className="mt-0.5 text-sm text-muted">{a.message}</p>
              <p className="mt-1 font-mono text-[10px] text-faint">
                {a.severity} · raised {timeAgo(a.raisedAtUtc)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
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
            Open alert console
          </Button>
          <Button ref={primary} variant="danger" loading={busy} onClick={acknowledgeAll} className="!bg-critical !text-white">
            Acknowledge all
          </Button>
        </div>
      </section>
    </div>
  );
}
