"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useAcknowledgeAlert, useResolveAlert } from "@/lib/api/queries";
import type { Alert } from "@/lib/api/types";

export function AlertActions({ alert }: { alert: Alert }) {
  const acknowledge = useAcknowledgeAlert();
  const resolve = useResolveAlert();
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");

  if (alert.status === "Resolved") return null;

  const onError = (error: Error) => toast.error("Action failed", { description: error.message });

  return (
    <div className="flex items-center gap-1.5">
      {alert.status === "Open" && (
        <Button
          size="sm"
          variant="secondary"
          loading={acknowledge.isPending}
          onClick={() =>
            acknowledge.mutate(alert.id, {
              onSuccess: () => toast.success("Alert acknowledged", { description: alert.message }),
              onError,
            })
          }
        >
          Ack
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => setResolving(true)}>
        Resolve
      </Button>

      <Dialog
        open={resolving}
        onClose={() => setResolving(false)}
        title="Resolve alert"
        description={`${alert.astronautName} — ${alert.message}`}
      >
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            resolve.mutate(
              { id: alert.id, note },
              {
                onSuccess: () => {
                  setResolving(false);
                  toast.success("Alert resolved", { description: alert.message });
                },
                onError,
              },
            );
          }}
        >
          <Field label="Resolution note (optional)">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. Crew rested, vitals normalised"
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setResolving(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={resolve.isPending}>
              Mark resolved
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
