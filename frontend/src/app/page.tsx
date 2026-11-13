"use client";

import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { AlertList } from "@/components/alerts/alert-list";
import { CrewQuickView } from "@/components/crew/crew-quick-view";
import { HazardSummaryRow } from "@/components/hazards/hazard-summary";
import { TrendWatch } from "@/components/monitor/early-warning";
import { CrewVitalsTable } from "@/components/overview/crew-vitals-table";
import { FleetTrend } from "@/components/overview/fleet-trend";
import { EventFeed } from "@/components/realtime/event-feed";
import { HEALTH_COLOR, HEALTH_LABEL } from "@/components/ui/badges";
import { AnimatedNumber, Sparkline, StackedBar } from "@/components/ui/data-viz";
import { RISK_TEXT } from "@/components/ui/ews";
import { ExportMenu } from "@/components/ui/export-menu";
import { Pager } from "@/components/ui/pager";
import { Card, CardTitle, Count, EmptyState, ErrorState, PageHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { useAlerts, useAstronauts, useDashboard, useFleetAssessments, useHazards, useMissions, useThresholds } from "@/lib/api/queries";
import type { DashboardSummary, HealthStatus } from "@/lib/api/types";
import { useHydrated } from "@/lib/hooks";
import { useMissionScope } from "@/lib/mission-scope";
import { PAGE_SIZE } from "@/lib/prefetch";
import { useEventRate, useEventRateSeries, useFleetReadings } from "@/lib/realtime/hooks";
import { useEventLog } from "@/lib/realtime/store";
import { reports } from "@/lib/reports";
import { HazardStripSkeleton, OverviewBodySkeleton } from "@/components/skeletons/page-skeletons";
import { SkeletonGroup, SkeletonList, SkeletonTable } from "@/components/ui/skeleton";

export default function OverviewPage() {
  const dashboard = useDashboard();
  const missions = useMissions();
  // The top bar shares these queries and can finish before this page hydrates: render the
  // server's (loading) markup first, then the data.
  const hydrated = useHydrated();
  const scope = useMissionScope();
  const focused = missions.data?.find((m) => m.id === scope);
  const active = focused ? [focused] : (missions.data?.filter((m) => m.status === "Active") ?? []);

  return (
    <>
      <PageHeader
        compact
        title="Overview"
        subtitle={
          hydrated && dashboard.data
            ? `${active.length ? active.map((m) => m.name).join(", ") : "No mission in flight"} · ${dashboard.data.totalCrew} crew monitored in real time`
            : "Crew health across every active mission."
        }
        action={<ExportMenu options={[reports.fleetPdf(), reports.crewExcel()]} />}
      />
      {dashboard.isPending || !hydrated ? (
        <OverviewBodySkeleton />
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <Overview summary={dashboard.data} />
      )}
    </>
  );
}

function Overview({ summary }: { summary: DashboardSummary }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const crew = useAstronauts({ pageSize: 100 });
  const thresholds = useThresholds();
  const { byAstronaut } = useFleetReadings();
  const scope = useMissionScope();
  const scopedCrew = useMemo(
    () => (scope ? (crew.data?.items ?? []).filter((a) => a.missionId === scope) : (crew.data?.items ?? [])),
    [crew.data, scope],
  );
  const scopedReadings = useMemo(
    () => (scope ? new Map([...byAstronaut].filter(([id]) => scopedCrew.some((a) => a.id === id))) : byAstronaut),
    [byAstronaut, scope, scopedCrew],
  );
  const attention = summary.crewHealth.critical + summary.crewHealth.caution;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <CrewHealthKpi summary={summary} />
        <AlertsKpi summary={summary} />
        <EwsKpi />
        <TelemetryKpi />
      </div>

      <HazardsStrip />

      <Card className="overflow-hidden p-0">
        <CardTitle
          className="mb-0 px-5 pt-4 pb-3"
          description="Live vitals for every crew member. Values outside the safe range are highlighted."
          action={
            <Segmented
              size="sm"
              label="Crew filter"
              value={attentionOnly}
              onChange={setAttentionOnly}
              options={[
                { value: false, label: "All", count: summary.totalCrew },
                { value: true, label: "Needs attention", count: attention },
              ]}
            />
          }
        >
          Crew vitals
        </CardTitle>
        {crew.isPending || thresholds.isPending ? (
          <SkeletonGroup label="Loading crew vitals">
            <SkeletonTable rows={6} columns={8} />
          </SkeletonGroup>
        ) : crew.isError ? (
          <div className="p-5">
            <ErrorState error={crew.error} onRetry={() => crew.refetch()} />
          </div>
        ) : (
          <CrewVitalsTable
            crew={scopedCrew}
            thresholds={thresholds.data ?? []}
            readings={scopedReadings}
            onSelect={setSelected}
            attentionOnly={attentionOnly}
          />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-12">
        <ActionQueue onSelectAstronaut={setSelected} />
        <Card className="flex flex-col lg:col-span-7">
          <CardTitle description="Crew average and spread over the last minutes, against the safe range.">Fleet trend</CardTitle>
          <FleetTrend readings={scopedReadings} thresholds={thresholds.data ?? []} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardTitle description="Vitals drifting toward a limit, soonest first." action={<CardLink href="/protocols">How it works</CardLink>}>
            Trend watch
          </CardTitle>
          <TrendWatch onSelect={setSelected} />
        </Card>
        <ActivityCard onSelectAstronaut={setSelected} />
      </div>

      <CrewQuickView astronautId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[12.5px] font-medium whitespace-nowrap text-muted transition-colors hover:bg-overlay/[0.05] hover:text-ink"
    >
      {children} <ArrowUpRight className="size-3.5" aria-hidden />
    </Link>
  );
}

/** Fleet status against NASA's five hazards of human spaceflight. */
function HazardsStrip() {
  const hazards = useHazards();
  return (
    <section aria-label="Five hazards of spaceflight">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13.5px] font-semibold text-ink">Five hazards of spaceflight</h2>
        <CardLink href="/hazards">Details</CardLink>
      </div>
      {hazards.data ? (
        <HazardSummaryRow summary={hazards.data.summary} />
      ) : (
        <SkeletonGroup label="Loading hazards">
          <HazardStripSkeleton />
        </SkeletonGroup>
      )}
    </section>
  );
}

// ---- KPIs ---------------------------------------------------------------------

function Kpi({
  label,
  href,
  children,
  footer,
}: {
  label: string;
  href?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const body = (
    <Card className={clsx("flex h-full flex-col gap-2 p-4 sm:p-5", href && "transition-colors hover:border-line-strong")}>
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-medium text-muted">{label}</p>
        {href && <ArrowUpRight className="size-3.5 text-faint opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
      </div>
      <div className="flex-1">{children}</div>
      {footer && <div className="text-[12px] text-muted">{footer}</div>}
    </Card>
  );
  return href ? (
    <Link href={href} className="group block rounded-[var(--radius-card)]">
      {body}
    </Link>
  ) : (
    body
  );
}

function BigNumber({ value, decimals = 0, suffix, className }: { value: number; decimals?: number; suffix?: ReactNode; className?: string }) {
  return (
    <p className={clsx("text-[28px] leading-none font-semibold tracking-[-0.02em] text-ink sm:text-[32px]", className)}>
      <AnimatedNumber value={value} decimals={decimals} />
      {suffix && <span className="ml-1.5 text-[13px] font-medium tracking-normal text-muted">{suffix}</span>}
    </p>
  );
}

const HEALTH_ORDER: HealthStatus[] = ["Critical", "Caution", "Nominal", "Unknown"];

function CrewHealthKpi({ summary }: { summary: DashboardSummary }) {
  const count = (s: HealthStatus) => summary.crewHealth[s.toLowerCase() as keyof DashboardSummary["crewHealth"]];
  const nominal = count("Nominal");
  return (
    <Kpi
      label="Crew health"
      href="/monitor"
      footer={
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {HEALTH_ORDER.filter((s) => count(s) > 0).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: HEALTH_COLOR[s] }} aria-hidden />
              <span className="tnum text-ink">{count(s)}</span> {HEALTH_LABEL[s].toLowerCase()}
            </span>
          ))}
        </span>
      }
    >
      <BigNumber value={nominal} suffix={`of ${summary.totalCrew} nominal`} />
      <div className="mt-3">
        <StackedBar segments={HEALTH_ORDER.map((status) => ({ status, value: count(status) }))} height={6} />
      </div>
    </Kpi>
  );
}

function AlertsKpi({ summary }: { summary: DashboardSummary }) {
  return (
    <Kpi
      label="Open alerts"
      href="/alerts"
      footer={
        <span className="flex flex-wrap gap-x-3">
          <span>
            <span className={clsx("tnum font-medium", summary.openCriticalAlerts > 0 ? "text-critical" : "text-ink")}>
              {summary.openCriticalAlerts}
            </span>{" "}
            critical
          </span>
          <span>
            <span className={clsx("tnum font-medium", summary.escalatedAlerts > 0 ? "text-critical" : "text-ink")}>
              {summary.escalatedAlerts}
            </span>{" "}
            escalated
          </span>
        </span>
      }
    >
      <BigNumber
        value={summary.openAlerts}
        className={summary.openCriticalAlerts > 0 ? "!text-critical" : summary.openAlerts > 0 ? "!text-caution" : undefined}
        suffix={summary.openAlerts === 0 ? "all clear" : undefined}
      />
    </Kpi>
  );
}

function EwsKpi() {
  const fleet = useFleetAssessments();
  const scored = (fleet.data ?? []).filter((a) => a.score !== null);
  const average = scored.length ? scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length : 0;
  const highest = [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  return (
    <Kpi
      label="Avg. early warning score"
      href="/protocols"
      footer={
        highest ? (
          <span className="block truncate">
            Highest: <span className="font-medium text-ink">{highest.astronautName}</span>{" "}
            <span className={clsx("tnum font-semibold", highest.risk && RISK_TEXT[highest.risk])}>{highest.score}</span>
          </span>
        ) : (
          "Awaiting telemetry"
        )
      }
    >
      {fleet.isPending ? <Skeleton className="h-8 w-20" /> : <BigNumber value={average} decimals={1} suffix="/ 15" />}
    </Kpi>
  );
}

function TelemetryKpi() {
  const rate = useEventRate();
  const series = useEventRateSeries(20, 30);
  return (
    <Kpi label="Telemetry" href="/events" footer="Readings per minute over SignalR">
      <div className="flex items-end justify-between gap-3">
        <BigNumber value={rate} suffix="/min" />
        <div className="w-24 pb-1 sm:w-28">
          <Sparkline values={series} color="var(--color-accent)" height={30} />
        </div>
      </div>
    </Kpi>
  );
}

// ---- Cards ----------------------------------------------------------------------

function ActionQueue({ onSelectAstronaut }: { onSelectAstronaut: (id: string) => void }) {
  const [page, setPage] = useState(1);
  // Server-side paging; the API already orders critical and escalated alerts first.
  const alerts = useAlerts({ status: "Open", page, pageSize: PAGE_SIZE.overviewAlerts });

  return (
    <Card className="flex flex-col lg:col-span-5">
      <CardTitle
        description="Open alerts, most urgent first. Acknowledge right here."
        action={
          <>
            {alerts.data && (
              <Pager variant="compact" page={alerts.data.page} totalPages={alerts.data.totalPages} onPageChange={setPage} busy={alerts.isPlaceholderData} />
            )}
            <CardLink href="/alerts">All</CardLink>
          </>
        }
      >
        Action queue {alerts.data && alerts.data.totalCount > 0 && <Count>{alerts.data.totalCount}</Count>}
      </CardTitle>
      <div className={clsx("-my-3 min-h-0 flex-1 transition-opacity", alerts.isPlaceholderData && "opacity-60")}>
        {alerts.isPending ? (
          <SkeletonGroup label="Loading alerts">
            <SkeletonList rows={4} />
          </SkeletonGroup>
        ) : alerts.data?.items.length ? (
          <AlertList alerts={alerts.data.items} compact onSelectAstronaut={onSelectAstronaut} />
        ) : (
          <EmptyState title="Nothing needs action">No open health alerts.</EmptyState>
        )}
      </div>
    </Card>
  );
}

function ActivityCard({ onSelectAstronaut }: { onSelectAstronaut: (id: string) => void }) {
  const events = useEventLog();
  const [kind, setKind] = useState<"all" | "alerts">("all");
  const filtered = useMemo(() => (kind === "all" ? events : events.filter((e) => e.kind !== "reading")), [events, kind]);

  return (
    <Card className="flex flex-col overflow-hidden lg:col-span-7">
      <CardTitle
        description="Everything arriving over the real-time uplink."
        action={
          <>
            <Segmented
              size="sm"
              label="Activity filter"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "All" },
                { value: "alerts", label: "Alerts" },
              ]}
            />
            <CardLink href="/events">Log</CardLink>
          </>
        }
      >
        Activity
      </CardTitle>
      <div className="min-h-0 flex-1">
        <EventFeed events={filtered} limit={7} onSelectAstronaut={onSelectAstronaut} />
      </div>
    </Card>
  );
}

