"use client";

import clsx from "clsx";
import { Activity, ArrowUpRight, BellRing, HeartPulse, Rocket, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AlertList } from "@/components/alerts/alert-list";
import { EarlyWarningBoard } from "@/components/monitor/early-warning";
import { MonitorTile } from "@/components/monitor/monitor-tile";
import { EventFeed } from "@/components/realtime/event-feed";
import { HEALTH_TEXT } from "@/components/ui/badges";
import { AnimatedNumber, StatusRing } from "@/components/ui/data-viz";
import { ExportMenu } from "@/components/ui/export-menu";
import { Pager } from "@/components/ui/pager";
import { Card, CardTitle, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useAlerts, useAstronauts, useDashboard, useThresholds } from "@/lib/api/queries";
import type { DashboardSummary, HealthStatus } from "@/lib/api/types";
import { useEventRate } from "@/lib/realtime/hooks";
import { useEventLog } from "@/lib/realtime/store";
import { PAGE_SIZE } from "@/lib/prefetch";
import { reports } from "@/lib/reports";
import { usePagination } from "@/lib/use-pagination";

/*
 * Single-screen layout: on large displays every card has a fixed height and pages its own
 * content, so the whole overview fits without scrolling. Small screens stack naturally.
 */
const ROW_HEIGHT = "lg:h-[270px]";

export default function OverviewPage() {
  const dashboard = useDashboard();

  return (
    <>
      <PageHeader
        compact
        eyebrow="Mission control · live"
        title="Overview"
        action={<ExportMenu options={[reports.fleetPdf(), reports.crewExcel()]} />}
      />
      {dashboard.isPending ? (
        <OverviewSkeleton />
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <Overview summary={dashboard.data} />
      )}
    </>
  );
}

function Overview({ summary }: { summary: DashboardSummary }) {
  const rate = useEventRate();
  const { crewHealth } = summary;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={<Users />} label="Crew monitored" value={summary.totalCrew} />
        <Kpi icon={<ShieldAlert />} label="Critical crew" value={crewHealth.critical} tone={crewHealth.critical > 0 ? "critical" : undefined} href="/monitor" />
        <Kpi icon={<HeartPulse />} label="Caution crew" value={crewHealth.caution} tone={crewHealth.caution > 0 ? "caution" : undefined} href="/monitor" />
        <Kpi
          icon={<BellRing />}
          label="Open alerts"
          value={summary.openAlerts}
          detail={summary.escalatedAlerts > 0 ? `${summary.escalatedAlerts} escalated` : `${summary.openCriticalAlerts} critical`}
          tone={summary.openCriticalAlerts > 0 || summary.escalatedAlerts > 0 ? "critical" : summary.openAlerts > 0 ? "caution" : undefined}
          href="/alerts"
        />
        <Kpi icon={<Rocket />} label="Missions in flight" value={summary.activeMissions} href="/missions" />
        <Kpi icon={<Activity />} label="Telemetry / min" value={rate} detail="SignalR packets" href="/events" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <FleetStatus summary={summary} />
        <PriorityAlerts />
        <LiveFeed />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <AttentionBoard />
        <Card className="flex flex-col lg:col-span-5">
          <CardTitle action={<CardLink href="/protocols">How it works</CardLink>}>Early warning</CardTitle>
          <EarlyWarningBoard pageSize={5} />
        </Card>
      </div>
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-1 text-xs whitespace-nowrap text-accent hover:underline">
      {children} <ArrowUpRight className="size-3" />
    </Link>
  );
}

const KPI_TONE = { critical: "text-critical", caution: "text-caution" } as const;

function Kpi({
  icon,
  label,
  value,
  detail,
  tone,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail?: string;
  tone?: keyof typeof KPI_TONE;
  href?: string;
}) {
  const body = (
    <Card tone={tone} className="h-full px-4 py-3 transition hover:border-accent/25">
      <div className="flex items-center justify-between text-muted [&_svg]:size-3.5">
        <p className="hud-label !text-[9px]">{label}</p>
        {icon}
      </div>
      <p className={clsx("mt-1 font-mono text-2xl font-semibold tracking-tight", tone ? KPI_TONE[tone] : "text-ink")}>
        <AnimatedNumber value={value} />
      </p>
      <p className="truncate text-[10.5px] text-muted">{detail ?? " "}</p>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function FleetStatus({ summary }: { summary: DashboardSummary }) {
  const statuses: HealthStatus[] = ["Critical", "Caution", "Nominal", "Unknown"];
  const count = (s: HealthStatus) => summary.crewHealth[s.toLowerCase() as keyof DashboardSummary["crewHealth"]];

  return (
    <Card hud className={clsx("flex flex-col lg:col-span-3", ROW_HEIGHT)}>
      <CardTitle>Fleet status</CardTitle>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <StatusRing size={130} segments={statuses.map((status) => ({ status, value: count(status) }))}>
          <div>
            <p className="font-mono text-3xl font-semibold text-ink">
              <AnimatedNumber value={summary.totalCrew} />
            </p>
            <p className="hud-label !text-[8.5px]">Crew</p>
          </div>
        </StatusRing>
        <dl className="grid w-full grid-cols-4 gap-1.5 text-center">
          {statuses.map((status) => (
            <div key={status} className="rounded-lg border border-line bg-overlay/[0.02] py-1">
              <dd className={clsx("font-mono text-base font-semibold", HEALTH_TEXT[status])}>{count(status)}</dd>
              <dt className="hud-label !text-[8px] !tracking-[0.08em]">{status}</dt>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}


function PriorityAlerts() {
  const [page, setPage] = useState(1);
  // Server-side paging; the API already orders critical and escalated alerts first.
  const alerts = useAlerts({ status: "Open", page, pageSize: PAGE_SIZE.overviewAlerts });

  return (
    <Card className={clsx("flex flex-col lg:col-span-6", ROW_HEIGHT)}>
      <CardTitle
        action={
          <div className="flex items-center gap-3">
            {alerts.data && (
              <Pager
                variant="compact"
                page={alerts.data.page}
                totalPages={alerts.data.totalPages}
                onPageChange={setPage}
                busy={alerts.isPlaceholderData}
              />
            )}
            <CardLink href="/alerts">Console</CardLink>
          </div>
        }
      >
        Priority alerts {alerts.data ? <span className="text-faint">· {alerts.data.totalCount}</span> : null}
      </CardTitle>
      <div className={clsx("min-h-0 flex-1 transition-opacity", alerts.isPlaceholderData && "opacity-60")}>
        {alerts.isPending ? (
          <Skeleton className="h-full min-h-40" />
        ) : alerts.data?.items.length ? (
          <AlertList alerts={alerts.data.items} compact dense />
        ) : (
          <EmptyState title="All systems nominal">No open health alerts.</EmptyState>
        )}
      </div>
    </Card>
  );
}

function LiveFeed() {
  const events = useEventLog();
  return (
    <Card className={clsx("flex flex-col overflow-hidden lg:col-span-3", ROW_HEIGHT)}>
      <CardTitle action={<CardLink href="/events">Log</CardLink>}>Live feed</CardTitle>
      <div className="min-h-0 flex-1 overflow-hidden">
        <EventFeed events={events} limit={6} />
      </div>
    </Card>
  );
}

const TILES_PER_PAGE = 2;

function AttentionBoard() {
  const crew = useAstronauts({ pageSize: 100 });
  const thresholds = useThresholds();
  const attention = (crew.data?.items ?? [])
    .filter((a) => a.healthStatus === "Critical" || a.healthStatus === "Caution")
    .sort((a, b) => (a.healthStatus === b.healthStatus ? 0 : a.healthStatus === "Critical" ? -1 : 1));
  const { page, setPage, totalPages, pageItems } = usePagination(attention, TILES_PER_PAGE);

  return (
    <Card className="flex flex-col lg:col-span-7">
      <CardTitle
        action={
          <div className="flex items-center gap-3">
            <Pager variant="compact" page={page} totalPages={totalPages} onPageChange={setPage} />
            <CardLink href="/monitor">Live monitor</CardLink>
          </div>
        }
      >
        Requires attention {attention.length > 0 && <span className="text-faint">· {attention.length}</span>}
      </CardTitle>
      {crew.isPending ? (
        <Skeleton className="h-56" />
      ) : attention.length === 0 ? (
        <EmptyState title="Every crew member is within safe limits">The live monitor shows all streams.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pageItems.map((a) => (
            <MonitorTile key={a.id} astronaut={a} thresholds={thresholds.data ?? []} />
          ))}
        </div>
      )}
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[84px]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[270px] lg:col-span-3" />
        <Skeleton className="h-[270px] lg:col-span-6" />
        <Skeleton className="h-[270px] lg:col-span-3" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[300px] lg:col-span-7" />
        <Skeleton className="h-[300px] lg:col-span-5" />
      </div>
    </div>
  );
}
