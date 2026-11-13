"use client";

import clsx from "clsx";
import { CheckCheck, CircleCheck, X } from "lucide-react";
import { useState } from "react";
import { confirm } from "@/lib/notify";
import { AlertList } from "@/components/alerts/alert-list";
import { CrewQuickView } from "@/components/crew/crew-quick-view";
import { Dialog } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { Pager } from "@/components/ui/pager";
import { Button, Card, Checkbox, EmptyState, ErrorState, Field, Input, PageHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { useAcknowledgeAlert, useAlerts, useDashboard, useResolveAlert } from "@/lib/api/queries";
import type { AlertSeverity, AlertStatus } from "@/lib/api/types";
import { useHydrated } from "@/lib/hooks";
import { PAGE_SIZE } from "@/lib/prefetch";
import { reports } from "@/lib/reports";

const SEVERITY_OPTIONS: { value: AlertSeverity | undefined; label: string }[] = [
  { value: undefined, label: "Any severity" },
  { value: "Critical", label: "Critical" },
  { value: "Warning", label: "Warning" },
];

export default function AlertsPage() {
  const [status, setStatus] = useState<AlertStatus | undefined>("Open");
  const [severity, setSeverity] = useState<AlertSeverity | undefined>();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickView, setQuickView] = useState<string | null>(null);

  const dashboard = useDashboard();
  // Shared queries may resolve before this page hydrates; keep the first render server-identical.
  const hydrated = useHydrated();
  const alerts = useAlerts({ status, severity, page, pageSize: PAGE_SIZE.alerts });

  const items = alerts.data?.items ?? [];
  const actionable = items.filter((a) => a.status !== "Resolved");
  const selectedItems = actionable.filter((a) => selected.has(a.id));
  const allSelected = actionable.length > 0 && selectedItems.length === actionable.length;

  const resetSelection = () => setSelected(new Set());
  const changeFilter = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
    resetSelection();
  };

  return (
    <>
      <PageHeader
        eyebrow="Monitoring"
        title="Alerts"
        subtitle="Raised automatically when a crew member's vitals leave their safe range."
        action={<ExportMenu options={[reports.alertsExcel(status, severity)]} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          label="Alert status"
          value={status}
          onChange={changeFilter(setStatus)}
          options={[
            { value: "Open", label: "Open" },
            { value: "Acknowledged", label: "Acknowledged" },
            { value: "Resolved", label: "Resolved" },
            { value: undefined, label: "All" },
          ]}
        />
        <Segmented label="Severity" options={SEVERITY_OPTIONS} value={severity} onChange={changeFilter(setSeverity)} />
      </div>

      <Card className="overflow-hidden p-0">
        {/* Toolbar: select-all + bulk actions, slides in when something is selected. */}
        <div className="flex h-12 items-center gap-3 border-b border-line bg-canvas px-5">
          <Checkbox
            checked={allSelected}
            indeterminate={selectedItems.length > 0 && !allSelected}
            onChange={(checked) => setSelected(checked ? new Set(actionable.map((a) => a.id)) : new Set())}
            label="Select all alerts on this page"
            className={clsx(actionable.length === 0 && "pointer-events-none opacity-40")}
          />
          {selectedItems.length > 0 ? (
            <BulkActions
              ids={selectedItems.map((a) => a.id)}
              openIds={selectedItems.filter((a) => a.status === "Open").map((a) => a.id)}
              onDone={resetSelection}
            />
          ) : (
            <p className="text-[12.5px] text-muted">
              {alerts.data ? (
                <>
                  <span className="tnum font-medium text-ink">{alerts.data.totalCount}</span> {status ? status.toLowerCase() : ""} alert
                  {alerts.data.totalCount === 1 ? "" : "s"}
                  {hydrated && dashboard.data && status === "Open" && dashboard.data.openCriticalAlerts > 0 && (
                    <>
                      {" · "}
                      <span className="tnum font-medium text-critical">{dashboard.data.openCriticalAlerts}</span> critical
                    </>
                  )}
                </>
              ) : (
                "Loading…"
              )}
            </p>
          )}
        </div>

        <div className={clsx("px-5 transition-opacity", alerts.isPlaceholderData && "opacity-60")}>
          {alerts.isPending ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : alerts.isError ? (
            <div className="py-4">
              <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} />
            </div>
          ) : items.length === 0 ? (
            <EmptyState title={status === "Open" ? "No open alerts" : "Nothing here"} icon={<CircleCheck />}>
              {status === "Open" ? "Every crew member is within safe limits." : "No alerts match the current filters."}
            </EmptyState>
          ) : (
            <AlertList
              alerts={items}
              compact={status !== undefined}
              selected={selected}
              onToggle={(id, checked) =>
                setSelected((s) => {
                  const next = new Set(s);
                  if (checked) next.add(id);
                  else next.delete(id);
                  return next;
                })
              }
              onSelectAstronaut={setQuickView}
            />
          )}
        </div>
      </Card>

      {alerts.data && (
        <Pager
          className="mt-4"
          page={alerts.data.page}
          totalPages={alerts.data.totalPages}
          totalItems={alerts.data.totalCount}
          pageSize={PAGE_SIZE.alerts}
          itemLabel="alerts"
          onPageChange={(p) => {
            setPage(p);
            resetSelection();
          }}
          busy={alerts.isPlaceholderData}
        />
      )}

      <CrewQuickView astronautId={quickView} onClose={() => setQuickView(null)} />
    </>
  );
}

function BulkActions({ ids, openIds, onDone }: { ids: string[]; openIds: string[]; onDone: () => void }) {
  const acknowledge = useAcknowledgeAlert();
  const resolve = useResolveAlert();
  const [busy, setBusy] = useState<"ack" | "resolve" | null>(null);
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");

  const runAll = async (kind: "ack" | "resolve", run: (id: string) => Promise<unknown>, list: string[]) => {
    setBusy(kind);
    const results = await Promise.allSettled(list.map(run));
    setBusy(null);
    const failed = results.filter((r) => r.status === "rejected").length;
    const done = list.length - failed;
    const verb = kind === "ack" ? "acknowledged" : "resolved";
    if (done > 0) confirm.done(`${done} alert${done > 1 ? "s" : ""} ${verb}`);
    if (failed > 0) confirm.failed(`${failed} alert${failed > 1 ? "s" : ""} not ${verb}`, "They may already be handled.");
    onDone();
  };

  return (
    <div className="flex min-w-0 flex-1 animate-fade-in items-center gap-2">
      <span className="tnum text-[12.5px] font-medium text-ink">{ids.length} selected</span>
      <div className="ml-auto flex items-center gap-1.5">
        {openIds.length > 0 && (
          <Button size="sm" variant="secondary" loading={busy === "ack"} onClick={() => runAll("ack", (id) => acknowledge.mutateAsync(id), openIds)}>
            <CheckCheck className="size-3.5" aria-hidden />
            Acknowledge{openIds.length !== ids.length ? ` ${openIds.length}` : ""}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setResolving(true)} disabled={busy !== null}>
          <CircleCheck className="size-3.5" aria-hidden /> Resolve
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} aria-label="Clear selection">
          <X className="size-3.5" aria-hidden />
        </Button>
      </div>

      <Dialog open={resolving} onClose={() => setResolving(false)} title={`Resolve ${ids.length} alert${ids.length > 1 ? "s" : ""}`}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setResolving(false);
            void runAll("resolve", (id) => resolve.mutateAsync({ id, note }), ids);
          }}
        >
          <Field label="Resolution note (optional)" hint="Applied to every selected alert.">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Crew rested, vitals normalised" autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setResolving(false)}>
              Cancel
            </Button>
            <Button type="submit">Resolve alerts</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
