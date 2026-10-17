"use client";

import clsx from "clsx";
import { ArrowLeft, ClipboardPlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AlertList } from "@/components/alerts/alert-list";
import { CrewAvatar } from "@/components/ui/avatar";
import { HEALTH_TEXT, HealthBadge } from "@/components/ui/badges";
import { RadialGauge, RangeBar } from "@/components/ui/data-viz";
import { ExportMenu } from "@/components/ui/export-menu";
import { Pager } from "@/components/ui/pager";
import { reports } from "@/lib/reports";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Button, Card, CardTitle, EmptyState, ErrorState, Segmented, Skeleton } from "@/components/ui/primitives";
import {
  useAlerts,
  useAstronaut,
  useDeleteAstronaut,
  useThresholds,
  useVitalStats,
  useVitalSeries,
} from "@/lib/api/queries";
import type { Alert, AstronautDetail, Threshold, VitalReading } from "@/lib/api/types";
import { formatDate, humanize, timeAgo } from "@/lib/format";
import { useIsLive } from "@/lib/realtime/store";
import { METRIC_VALUE, classify, describeRange } from "@/lib/vitals";
import { AssessmentPanel } from "@/components/monitor/early-warning";
import { RecordVitalsForm } from "./record-vitals-form";
import { VitalsChart } from "./vitals-chart";

const WINDOWS = [
  { value: 24, label: "24h" },
  { value: 72, label: "3d" },
  { value: 168, label: "7d" },
];


export function AstronautProfile() {
  const { id } = useParams<{ id: string }>();
  const astronaut = useAstronaut(id);

  if (astronaut.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (astronaut.isError) {
    return (
      <>
        <BackLink />
        <ErrorState error={astronaut.error} onRetry={() => astronaut.refetch()} />
      </>
    );
  }

  return <ProfileView astronaut={astronaut.data} />;
}

function BackLink() {
  return (
    <Link href="/crew" className="hud-label mb-5 inline-flex items-center gap-1.5 transition hover:!text-ink">
      <ArrowLeft className="size-3.5" aria-hidden /> Crew roster
    </Link>
  );
}

function ProfileView({ astronaut: a }: { astronaut: AstronautDetail }) {
  const router = useRouter();
  const [hours, setHours] = useState(72);
  const [recording, setRecording] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const thresholds = useThresholds();
  const vitals = useVitalSeries(a.id, hours);
  const stats = useVitalStats(a.id, 24);
  const [alertPage, setAlertPage] = useState(1);
  const alerts = useAlerts({ astronautId: a.id, page: alertPage, pageSize: 5 });
  const remove = useDeleteAstronaut();
  const isLive = useIsLive();

  const thresholdOf = (metric: Threshold["metric"]) => thresholds.data?.find((t) => t.metric === metric);
  const latest = a.latestReading;
  // The gauge spans up to the critical radiation limit served by the API.
  const radiationMax = thresholdOf("RadiationDose")?.criticalHigh ?? 0;
  const dose24h = stats.data?.totalRadiationMsv ?? 0;

  const onRecorded = (raised: Alert[]) => {
    setRecording(false);
    if (raised.length === 0) {
      toast.success("Reading recorded", { description: "All vitals within safe limits." });
      return;
    }
    // When the uplink is live, each alert arrives as its own SignalR toast — no need to repeat them.
    if (isLive) return;
    const critical = raised.some((x) => x.severity === "Critical");
    (critical ? toast.error : toast.warning)(`${raised.length} new alert${raised.length > 1 ? "s" : ""} raised`, {
      description: raised.map((x) => x.message).join(" · "),
      duration: 10_000,
    });
  };

  return (
    <>
      <BackLink />

      {/* Identity header */}
      <Card hud tone={a.healthStatus === "Critical" ? "critical" : undefined} className="mb-4 p-6">
        <div className="flex flex-wrap items-center gap-6">
          <CrewAvatar firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-ink">
                {a.firstName} {a.lastName}
              </h1>
              <HealthBadge status={a.healthStatus} />
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
              <Meta label="Role" value={humanize(a.role)} />
              <Meta label="Agency" value={a.agency} />
              <Meta label="Mission" value={a.missionName ?? "Unassigned"} />
              <Meta label="Age" value={`${a.age} · b. ${formatDate(a.dateOfBirth)}`} />
              <Meta label="Open alerts" value={String(a.openAlerts)} tone={a.openAlerts > 0 ? HEALTH_TEXT[a.healthStatus] : undefined} />
            </dl>
          </div>
          <div className="flex gap-2">
            <ExportMenu options={[reports.astronautPdf(a.id, hours), reports.vitalsExcel(a.id, hours)]} />
            <Button variant="danger" onClick={() => setConfirmingDelete(true)} aria-label="Delete astronaut">
              <Trash2 className="size-4" aria-hidden />
            </Button>
            <Button onClick={() => setRecording(true)}>
              <ClipboardPlus className="size-4" aria-hidden /> Record vitals
            </Button>
          </div>
        </div>
      </Card>

      {/* Latest vitals */}
      {latest ? (
        <section aria-label="Latest vitals" className="mb-4">
          <p className="hud-label mb-2">
            Latest telemetry · {timeAgo(latest.recordedAtUtc)}
            {latest.notes && <span className="normal-case tracking-normal text-faint"> — “{latest.notes}”</span>}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {(thresholds.data ?? []).map((t) => (
              <VitalTile key={t.metric} reading={latest} threshold={t} />
            ))}
          </div>
        </section>
      ) : (
        <Card className="mb-4">
          <EmptyState title="No telemetry yet">Record the first reading to start monitoring.</EmptyState>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Trend chart */}
        <Card className="lg:col-span-8">
          <CardTitle action={<Segmented label="Time window" options={WINDOWS} value={hours} onChange={setHours} />}>
            Vitals trend
          </CardTitle>
          {vitals.isPending ? (
            <Skeleton className="h-80" />
          ) : vitals.isError ? (
            <ErrorState error={vitals.error} />
          ) : vitals.data.points.length === 0 ? (
            <EmptyState title="No readings in this window" />
          ) : (
            <>
              <VitalsChart readings={vitals.data.points} thresholds={thresholds.data ?? []} />
              <p className="mt-1 text-right font-mono text-[10px] text-faint">
                {vitals.data.rawSampleCount.toLocaleString()} samples · {vitals.data.points.length} points · {vitals.data.bucketSeconds}s buckets
              </p>
            </>
          )}
        </Card>

        {/* Gauges */}
        <Card className="lg:col-span-4">
          <CardTitle>Life support indicators</CardTitle>
          {latest && thresholds.data ? (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <RadialGauge
                label="SpO₂"
                unit="%"
                value={latest.oxygenSaturationPct}
                min={80}
                max={100}
                decimals={1}
                status={classify(latest.oxygenSaturationPct, thresholdOf("OxygenSaturation"))}
              />
              <RadialGauge
                label="Dose · 24h"
                unit="mSv"
                value={dose24h}
                min={0}
                max={radiationMax}
                decimals={2}
                status={classify(dose24h, thresholdOf("RadiationDose"))}
              />
            </div>
          ) : (
            <EmptyState title="Awaiting telemetry" />
          )}
          {stats.data && stats.data.readingCount > 0 && (
            <dl className="mt-4 space-y-2 border-t border-line pt-4">
              {stats.data.metrics
                .filter((m) => m.metric !== "RadiationDose")
                .map((m) => {
                  const t = thresholdOf(m.metric);
                  return (
                    <div key={m.metric} className="flex items-baseline justify-between gap-3 text-xs">
                      <dt className="text-muted">{t?.label ?? m.metric}</dt>
                      <dd className="font-mono text-ink">
                        {m.min}–{m.max}
                        <span className="text-faint"> · avg {m.average}</span>
                      </dd>
                    </div>
                  );
                })}
              <p className="hud-label !text-[9px] pt-1">Last 24h · {stats.data.readingCount} readings</p>
            </dl>
          )}
        </Card>

        {/* Early warning */}
        <Card hud className="lg:col-span-4">
          <CardTitle>Early warning</CardTitle>
          <AssessmentPanel astronautId={a.id} />
        </Card>

        {/* Alerts */}
        <Card className="lg:col-span-8">
          <CardTitle
            action={
              alerts.data && (
                <Pager
                  variant="compact"
                  page={alerts.data.page}
                  totalPages={alerts.data.totalPages}
                  onPageChange={setAlertPage}
                  busy={alerts.isPlaceholderData}
                />
              )
            }
          >
            Medical alert log {alerts.data ? <span className="text-faint">· {alerts.data.totalCount}</span> : null}
          </CardTitle>
          {alerts.data?.items.length ? (
            <div className={clsx("transition-opacity", alerts.isPlaceholderData && "opacity-60")}>
              <AlertList alerts={alerts.data.items} showAstronaut={false} />
            </div>
          ) : (
            <EmptyState title="No alerts on record" />
          )}
        </Card>
      </div>

      <Dialog
        open={recording}
        onClose={() => setRecording(false)}
        title="Record vitals"
        description={`New telemetry reading for ${a.firstName} ${a.lastName}. Pre-filled with the last values.`}
      >
        <RecordVitalsForm
          astronautId={a.id}
          previous={latest}
          onCancel={() => setRecording(false)}
          onRecorded={onRecorded}
        />
      </Dialog>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete astronaut?"
        message={
          <>
            This permanently removes <span className="text-ink">{a.firstName} {a.lastName}</span> and all of their vitals
            and alert history.
          </>
        }
        confirmLabel="Delete permanently"
        loading={remove.isPending}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() =>
          remove.mutate(a.id, {
            onSuccess: () => {
              toast.success(`${a.firstName} ${a.lastName} removed`);
              router.push("/crew");
            },
            onError: (error) => toast.error("Delete failed", { description: error.message }),
          })
        }
      />
    </>
  );
}

function Meta({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="hud-label !text-[9px]">{label}</dt>
      <dd className={clsx("text-sm", tone ?? "text-ink")}>{value}</dd>
    </div>
  );
}

function VitalTile({ reading, threshold }: { reading: VitalReading; threshold: Threshold }) {
  const value = METRIC_VALUE[threshold.metric](reading);
  const status = classify(value, threshold);
  return (
    <Card tone={status === "Critical" ? "critical" : status === "Caution" ? "caution" : undefined} className="p-4">
      <p className="hud-label !text-[9px] truncate">{threshold.label}</p>
      <p className={clsx("mt-2 font-mono text-2xl font-semibold", HEALTH_TEXT[status] ?? "text-ink")}>
        {value}
        <span className="ml-1 text-[10px] font-normal text-muted">{threshold.unit}</span>
      </p>
      <RangeBar value={value} threshold={threshold} status={status} />
      <p className="mt-2 font-mono text-[9.5px] text-faint">safe {describeRange(threshold)}</p>
    </Card>
  );
}
