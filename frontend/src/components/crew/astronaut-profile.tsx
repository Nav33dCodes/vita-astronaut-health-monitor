"use client";

import clsx from "clsx";
import { ArrowLeft, ClipboardPlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AlertList } from "@/components/alerts/alert-list";
import { AssessmentPanel } from "@/components/monitor/early-warning";
import { CrewAvatar } from "@/components/ui/avatar";
import { HEALTH_TEXT, HealthBadge } from "@/components/ui/badges";
import { RadialGauge, RangeBar } from "@/components/ui/data-viz";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { LiveValue } from "@/components/ui/live-value";
import { Pager } from "@/components/ui/pager";
import { Button, Card, CardTitle, Count, EmptyState, ErrorState, IconButton, Segmented, Skeleton } from "@/components/ui/primitives";
import { useAlerts, useAstronaut, useDeleteAstronaut, useThresholds, useVitalSeries, useVitalStats } from "@/lib/api/queries";
import type { Alert, AstronautDetail, Threshold, VitalReading } from "@/lib/api/types";
import { formatDate, humanize, timeAgo } from "@/lib/format";
import { useLiveVitals } from "@/lib/realtime/hooks";
import { useIsLive } from "@/lib/realtime/store";
import { reports } from "@/lib/reports";
import { METRIC_VALUE, classify, describeRange } from "@/lib/vitals";
import { RecordVitalsForm } from "./record-vitals-form";
import { VitalsChart } from "./vitals-chart";

const WINDOWS = [
  { value: 24, label: "24h" },
  { value: 72, label: "3d" },
  { value: 168, label: "7d" },
];

type Tab = "overview" | "trends" | "alerts";

export function AstronautProfile() {
  const { id } = useParams<{ id: string }>();
  const astronaut = useAstronaut(id);

  if (astronaut.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-[var(--radius-card)]" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-96 rounded-[var(--radius-card)]" />
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
    <Link href="/crew" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink">
      <ArrowLeft className="size-3.5" aria-hidden /> Crew
    </Link>
  );
}

function ProfileView({ astronaut: a }: { astronaut: AstronautDetail }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [hours, setHours] = useState(72);
  const [recording, setRecording] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [alertPage, setAlertPage] = useState(1);

  const thresholds = useThresholds();
  const alerts = useAlerts({ astronautId: a.id, page: alertPage, pageSize: 8 });
  const remove = useDeleteAstronaut();
  const isLive = useIsLive();
  const { readings } = useLiveVitals(a.id);
  // Prefer the live buffer; fall back to the last stored reading.
  const latest = readings.at(-1) ?? a.latestReading ?? undefined;

  const onRecorded = (raised: Alert[]) => {
    setRecording(false);
    if (raised.length === 0) {
      toast.success("Reading recorded", { description: "All vitals within safe limits." });
      return;
    }
    // When the uplink is live, each alert arrives as its own real-time toast: no need to repeat them.
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
      <header className="mb-5 flex flex-wrap items-center gap-4 sm:gap-5">
        <CrewAvatar firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
              {a.firstName} {a.lastName}
            </h1>
            <HealthBadge status={a.healthStatus} />
          </div>
          <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
            <Meta label="Role" value={humanize(a.role)} />
            <Meta label="Agency" value={a.agency} />
            <Meta label="Mission" value={a.missionName ?? "Unassigned"} />
            <Meta label="Age" value={`${a.age} (b. ${formatDate(a.dateOfBirth)})`} />
          </dl>
        </div>
        <div className="flex gap-2">
          <ExportMenu options={[reports.astronautPdf(a.id, hours), reports.vitalsExcel(a.id, hours)]} />
          <IconButton onClick={() => setConfirmingDelete(true)} aria-label="Delete astronaut" title="Delete astronaut" className="!size-9 hover:!text-critical">
            <Trash2 />
          </IconButton>
          <Button onClick={() => setRecording(true)}>
            <ClipboardPlus className="size-4" aria-hidden /> Record vitals
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div role="tablist" aria-label="Profile sections" className="mb-5 flex gap-5 overflow-x-auto border-b border-line">
        {(
          [
            ["overview", "Overview", null],
            ["trends", "Trends", null],
            ["alerts", "Alerts", a.openAlerts > 0 ? a.openAlerts : null],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={clsx(
              "relative -mb-px flex h-10 items-center gap-1.5 border-b-2 text-[13.5px] font-medium whitespace-nowrap transition-colors",
              tab === value ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {label}
            {count !== null && <Count>{count}</Count>}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-page-in">
        {tab === "overview" && <OverviewTab astronaut={a} latest={latest} thresholds={thresholds.data} />}
        {tab === "trends" && <TrendsTab astronautId={a.id} hours={hours} setHours={setHours} thresholds={thresholds.data ?? []} />}
        {tab === "alerts" && (
          <Card>
            <CardTitle
              action={
                alerts.data && (
                  <Pager variant="compact" page={alerts.data.page} totalPages={alerts.data.totalPages} onPageChange={setAlertPage} busy={alerts.isPlaceholderData} />
                )
              }
            >
              Medical alert log {alerts.data && <Count>{alerts.data.totalCount}</Count>}
            </CardTitle>
            {alerts.isPending ? (
              <Skeleton className="h-48" />
            ) : alerts.data?.items.length ? (
              <div className={clsx("-my-3 transition-opacity", alerts.isPlaceholderData && "opacity-60")}>
                <AlertList alerts={alerts.data.items} showAstronaut={false} />
              </div>
            ) : (
              <EmptyState title="No alerts on record" />
            )}
          </Card>
        )}
      </div>

      <Dialog
        open={recording}
        onClose={() => setRecording(false)}
        title="Record vitals"
        description={`New reading for ${a.firstName} ${a.lastName}. Pre-filled with the last values.`}
      >
        <RecordVitalsForm astronautId={a.id} previous={a.latestReading} onCancel={() => setRecording(false)} onRecorded={onRecorded} />
      </Dialog>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete astronaut?"
        message={
          <>
            This permanently removes{" "}
            <span className="font-medium text-ink">
              {a.firstName} {a.lastName}
            </span>{" "}
            and all of their vitals and alert history. This cannot be undone.
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

function OverviewTab({
  astronaut: a,
  latest,
  thresholds,
}: {
  astronaut: AstronautDetail;
  latest: VitalReading | undefined;
  thresholds: Threshold[] | undefined;
}) {
  const stats = useVitalStats(a.id, 24);
  const thresholdOf = (metric: Threshold["metric"]) => thresholds?.find((t) => t.metric === metric);
  // The gauge spans up to the critical radiation limit served by the API.
  const radiationMax = thresholdOf("RadiationDose")?.criticalHigh ?? 0;
  const dose24h = stats.data?.totalRadiationMsv ?? 0;

  return (
    <div className="space-y-4">
      {latest ? (
        <section aria-label="Latest vitals">
          <p className="mb-2 text-[12.5px] text-muted">
            Latest reading {timeAgo(latest.recordedAtUtc)}
            {latest.notes && <span className="text-faint"> · “{latest.notes}”</span>}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {(thresholds ?? []).map((t) => (
              <VitalTile key={t.metric} reading={latest} threshold={t} />
            ))}
          </div>
        </section>
      ) : (
        <Card>
          <EmptyState title="No telemetry yet">Record the first reading to start monitoring.</EmptyState>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardTitle description="Score breakdown and detected trends over the last hour.">Early warning</CardTitle>
          <AssessmentPanel astronautId={a.id} />
        </Card>

        <Card className="lg:col-span-5">
          <CardTitle description="Last 24 hours">Life support</CardTitle>
          {latest && thresholds ? (
            <div className="grid grid-cols-2 gap-2">
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
                label="Radiation dose"
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
                .map((m) => (
                  <div key={m.metric} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <dt className="text-muted">{thresholdOf(m.metric)?.label ?? m.metric}</dt>
                    <dd className="tnum text-ink">
                      {m.min}–{m.max}
                      <span className="text-faint"> · avg {m.average}</span>
                    </dd>
                  </div>
                ))}
              <p className="pt-1 text-[12px] text-faint">{stats.data.readingCount} readings in the last 24h</p>
            </dl>
          )}
        </Card>
      </div>
    </div>
  );
}

function TrendsTab({
  astronautId,
  hours,
  setHours,
  thresholds,
}: {
  astronautId: string;
  hours: number;
  setHours: (h: number) => void;
  thresholds: Threshold[];
}) {
  const vitals = useVitalSeries(astronautId, hours);

  return (
    <Card>
      <CardTitle
        description="Server-side downsampled history against each vital's safe range."
        action={<Segmented size="sm" label="Time window" options={WINDOWS} value={hours} onChange={setHours} />}
      >
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
          <VitalsChart readings={vitals.data.points} thresholds={thresholds} />
          <p className="tnum mt-2 text-right text-[12px] text-faint">
            {vitals.data.rawSampleCount.toLocaleString()} samples · {vitals.data.points.length} points · {vitals.data.bucketSeconds}s buckets
          </p>
        </>
      )}
    </Card>
  );
}

function Meta({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-faint">{label}</dt>
      <dd className={tone ?? "text-ink"}>{value}</dd>
    </div>
  );
}

function VitalTile({ reading, threshold }: { reading: VitalReading; threshold: Threshold }) {
  const value = METRIC_VALUE[threshold.metric](reading);
  const status = classify(value, threshold);
  const flagged = status === "Critical" || status === "Caution";
  return (
    <Card tone={status === "Critical" ? "critical" : status === "Caution" ? "caution" : undefined} className="p-4">
      <p className="truncate text-[12px] font-medium text-muted">{threshold.label}</p>
      <p className={clsx("mt-1.5 text-[22px] leading-tight font-semibold tracking-tight", flagged ? HEALTH_TEXT[status] : "text-ink")}>
        <LiveValue value={value}>{value}</LiveValue>
        <span className="ml-1 text-[11px] font-normal tracking-normal text-muted">{threshold.unit}</span>
      </p>
      <RangeBar value={value} threshold={threshold} status={status} />
      <p className="mt-2 text-[11.5px] text-faint">Safe {describeRange(threshold)}</p>
    </Card>
  );
}
