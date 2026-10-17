"use client";

import clsx from "clsx";
import { useState } from "react";
import { AlertList } from "@/components/alerts/alert-list";
import { ExportMenu } from "@/components/ui/export-menu";
import { Pager } from "@/components/ui/pager";
import { Card, EmptyState, ErrorState, PageHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { useAlerts, useDashboard } from "@/lib/api/queries";
import type { AlertSeverity, AlertStatus } from "@/lib/api/types";
import { PAGE_SIZE } from "@/lib/prefetch";
import { reports } from "@/lib/reports";

const STATUS_OPTIONS: { value: AlertStatus | undefined; label: string }[] = [
  { value: "Open", label: "Open" },
  { value: "Acknowledged", label: "Acknowledged" },
  { value: "Resolved", label: "Resolved" },
  { value: undefined, label: "All" },
];

const SEVERITY_OPTIONS: { value: AlertSeverity | undefined; label: string }[] = [
  { value: undefined, label: "Any severity" },
  { value: "Critical", label: "Critical" },
  { value: "Warning", label: "Warning" },
];

export default function AlertsPage() {
  const [status, setStatus] = useState<AlertStatus | undefined>("Open");
  const [severity, setSeverity] = useState<AlertSeverity | undefined>();
  const [page, setPage] = useState(1);

  const dashboard = useDashboard();
  const alerts = useAlerts({ status, severity, page, pageSize: PAGE_SIZE.alerts });

  return (
    <>
      <PageHeader
        eyebrow="Flight surgeon console"
        title="Health alerts"
        subtitle="Raised automatically when a crew member's vitals leave their safe range."
        action={
          <div className="flex items-end gap-6">
            {dashboard.data && (
              <div className="flex gap-6 font-mono">
                <Counter label="Open" value={dashboard.data.openAlerts} className="text-caution" />
                <Counter label="Critical" value={dashboard.data.openCriticalAlerts} className="text-critical" />
              </div>
            )}
            <ExportMenu options={[reports.alertsExcel(status, severity)]} />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          label="Alert status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
        <Segmented
          label="Severity"
          options={SEVERITY_OPTIONS}
          value={severity}
          onChange={(v) => {
            setSeverity(v);
            setPage(1);
          }}
        />
      </div>

      {alerts.isPending ? (
        <Skeleton className="h-96" />
      ) : alerts.isError ? (
        <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} />
      ) : alerts.data.items.length === 0 ? (
        <Card>
          <EmptyState title="Nothing here">No alerts match the current filters.</EmptyState>
        </Card>
      ) : (
        <div className={clsx("transition-opacity", alerts.isPlaceholderData && "opacity-60")}>
          <AlertList alerts={alerts.data.items} />
        </div>
      )}

      {alerts.data && (
        <Pager
          className="mt-4"
          page={alerts.data.page}
          totalPages={alerts.data.totalPages}
          totalItems={alerts.data.totalCount}
          pageSize={PAGE_SIZE.alerts}
          itemLabel="alerts"
          onPageChange={setPage}
          busy={alerts.isPlaceholderData}
        />
      )}
    </>
  );
}

function Counter({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="text-right">
      <p className="hud-label !text-[9px]">{label}</p>
      <p className={`text-3xl font-semibold ${value > 0 ? className : "text-faint"}`}>{value}</p>
    </div>
  );
}
