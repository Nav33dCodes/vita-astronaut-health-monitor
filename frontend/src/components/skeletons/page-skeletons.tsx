import clsx from "clsx";
import {
  Skeleton,
  SkeletonCard,
  SkeletonChart,
  SkeletonGroup,
  SkeletonKpi,
  SkeletonList,
  SkeletonTable,
  SkeletonText,
  SkeletonTiles,
} from "@/components/ui/skeleton";

/*
 * Page-level loading layouts. Each one mirrors its page section by section, so the route-level
 * loading.tsx and the page's own data-loading state look identical and nothing jumps.
 * Server-safe: no hooks, no client-only APIs.
 */

/** Real title text (known up front) with skeleton subtitle and actions. */
export function PageHeaderSkeleton({ eyebrow, title, actions = 1 }: { eyebrow?: string; title: string; actions?: number }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[12.5px] font-medium text-muted">{eyebrow}</p>}
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-2xl">{title}</h1>
        <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28 !rounded-lg" />
        ))}
      </div>
    </header>
  );
}

// `Skeleton` takes classes only; widths here come from a fixed set.
const W: Record<number, string> = { 96: "w-24", 128: "w-32", 160: "w-40", 200: "w-52", 260: "w-64", 288: "w-72" };
function Filters({ widths }: { widths: number[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {widths.map((w, i) => (
        <Skeleton key={i} className={clsx("h-9 max-w-full !rounded-lg", W[w] ?? "w-40")} />
      ))}
    </div>
  );
}

// ---- Overview ---------------------------------------------------------------------------------

export function HazardStripSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2.5 bg-panel p-4 last:col-span-2 sm:last:col-span-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function OverviewBodySkeleton() {
  return (
    <SkeletonGroup label="Loading overview" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonKpi key={i} />
        ))}
      </div>
      <div>
        <Skeleton className="mb-2.5 h-3.5 w-44" />
        <HazardStripSkeleton />
      </div>
      <SkeletonCard className="!p-0" title={false}>
        <div className="space-y-2 px-5 pt-4 pb-3">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <SkeletonTable rows={6} columns={8} />
      </SkeletonCard>
      <div className="grid gap-4 lg:grid-cols-12">
        <SkeletonCard className="lg:col-span-5">
          <SkeletonList rows={4} />
        </SkeletonCard>
        <SkeletonCard className="lg:col-span-7">
          <SkeletonChart height={260} />
        </SkeletonCard>
      </div>
    </SkeletonGroup>
  );
}

export function OverviewSkeleton() {
  return (
    <>
      <PageHeaderSkeleton title="Overview" />
      <OverviewBodySkeleton />
    </>
  );
}

// ---- Hazards ------------------------------------------------------------------------------------

export function HabitatTilesSkeleton() {
  return (
    <SkeletonTiles
      count={6}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
      tile={
        <div className="space-y-2 rounded-lg border border-line p-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2.5 w-14" />
        </div>
      }
    />
  );
}

export function HazardsBodySkeleton() {
  return (
    <SkeletonGroup label="Loading hazards" className="space-y-4">
      <HazardStripSkeleton />
      <SkeletonCard className="!p-0" title={false}>
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-7 w-48 !rounded-md" />
        </div>
        <div className="border-t border-line px-5 py-4">
          <Skeleton className="mb-3 h-3.5 w-36" />
          <HabitatTilesSkeleton />
        </div>
        <div className="border-t border-line pt-4">
          <Skeleton className="mx-5 mb-3 h-3.5 w-28" />
          <SkeletonTable rows={4} columns={6} />
        </div>
      </SkeletonCard>
    </SkeletonGroup>
  );
}

export function HazardsSkeleton() {
  return (
    <>
      <PageHeaderSkeleton eyebrow="Monitoring" title="Hazards" />
      <HazardsBodySkeleton />
    </>
  );
}

// ---- Live monitor -------------------------------------------------------------------------------

export function MonitorTileSkeleton() {
  return (
    <div className="glass flex flex-col rounded-[var(--radius-card)] p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 !rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2.5 w-36" />
        </div>
        <Skeleton className="h-[22px] w-16 !rounded-md" />
      </div>
      <div className="mt-4 flex items-end gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-10 flex-1" />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2 border-t border-line pt-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-2.5 w-8" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-[22px] w-14 !rounded-md" />
      </div>
    </div>
  );
}

export function MonitorTilesSkeleton({ count = 8 }: { count?: number }) {
  return (
    <SkeletonGroup label="Loading live monitor">
      <SkeletonTiles count={count} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" tile={<MonitorTileSkeleton />} />
    </SkeletonGroup>
  );
}

export function MonitorSkeleton() {
  return (
    <>
      <PageHeaderSkeleton eyebrow="Monitoring" title="Live monitor" />
      <Filters widths={[160, 160, 160]} />
      <MonitorTilesSkeleton />
    </>
  );
}

// ---- Alerts -------------------------------------------------------------------------------------

export function AlertsBodySkeleton() {
  return (
    <SkeletonGroup label="Loading alerts">
      <div className="glass overflow-hidden rounded-[var(--radius-card)]">
        <div className="flex h-12 items-center gap-3 border-b border-line bg-canvas px-5">
          <Skeleton className="size-4" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="px-5">
          <SkeletonList rows={7} checkbox />
        </div>
      </div>
    </SkeletonGroup>
  );
}

export function AlertsSkeleton() {
  return (
    <>
      <PageHeaderSkeleton eyebrow="Monitoring" title="Alerts" />
      <Filters widths={[288, 260]} />
      <AlertsBodySkeleton />
    </>
  );
}

// ---- Crew ---------------------------------------------------------------------------------------

export function CrewTableSkeleton() {
  return (
    <SkeletonGroup label="Loading crew">
      <div className="glass overflow-hidden rounded-[var(--radius-card)]">
        <SkeletonTable rows={8} columns={6} />
      </div>
    </SkeletonGroup>
  );
}

export function CrewSkeleton() {
  return (
    <>
      <PageHeaderSkeleton eyebrow="Operations" title="Crew" actions={2} />
      <Filters widths={[288, 160, 288]} />
      <CrewTableSkeleton />
    </>
  );
}

export function ProfileSkeleton() {
  return (
    <SkeletonGroup label="Loading crew member" className="space-y-5">
      <Skeleton className="h-3.5 w-14" />
      <div className="flex flex-wrap items-center gap-5">
        <Skeleton className="size-16 !rounded-full" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 !rounded-lg" />
          <Skeleton className="h-9 w-32 !rounded-lg" />
        </div>
      </div>
      <div className="flex gap-5 border-b border-line pb-3">
        {["w-16", "w-12", "w-[60px]", "w-11"].map((w) => (
          <Skeleton key={w} className={clsx("h-3.5", w)} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="glass space-y-2.5 rounded-[var(--radius-card)] p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-14" />
            <Skeleton className="h-1 w-full" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <SkeletonCard className="lg:col-span-7">
          <SkeletonText lines={6} />
        </SkeletonCard>
        <SkeletonCard className="lg:col-span-5">
          <SkeletonChart height={200} />
        </SkeletonCard>
      </div>
    </SkeletonGroup>
  );
}

// ---- Missions, events, system, protocols ----------------------------------------------------------

function MissionCardSkeleton() {
  return (
    <div className="glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5">
      <div className="flex justify-between">
        <Skeleton className="size-10 !rounded-lg" />
        <Skeleton className="h-[22px] w-20 !rounded-md" />
      </div>
      <Skeleton className="mt-1 h-4 w-36" />
      <Skeleton className="h-3 w-44" />
      <SkeletonText lines={2} />
      <Skeleton className="h-14 w-full !rounded-lg" />
      <div className="mt-2 flex justify-between">
        <Skeleton className="h-8 w-28 !rounded-full" />
        <Skeleton className="h-8 w-24 !rounded-lg" />
      </div>
    </div>
  );
}

export function MissionsGridSkeleton() {
  return (
    <SkeletonGroup label="Loading missions">
      <SkeletonTiles count={3} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" tile={<MissionCardSkeleton />} />
    </SkeletonGroup>
  );
}

export function MissionsSkeleton() {
  return (
    <>
      <PageHeaderSkeleton eyebrow="Operations" title="Missions" />
      <MissionsGridSkeleton />
    </>
  );
}

export function EventsSkeleton() {
  return (
    <>
      <PageHeaderSkeleton eyebrow="Monitoring" title="Event log" actions={0} />
      <Filters widths={[288, 200, 96, 96]} />
      <SkeletonGroup label="Loading events">
        <div className="glass overflow-hidden rounded-[var(--radius-card)]">
          <SkeletonTable rows={10} columns={4} avatar={false} />
        </div>
      </SkeletonGroup>
    </>
  );
}

export function SystemSkeleton() {
  return (
    <>
      <PageHeaderSkeleton eyebrow="System" title="System status" />
      <SkeletonGroup label="Loading system status" className="space-y-4">
        <SkeletonTiles
          count={4}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          tile={
            <div className="glass space-y-3 rounded-[var(--radius-card)] p-5">
              <div className="flex justify-between">
                <Skeleton className="size-9 !rounded-lg" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-32" />
              <SkeletonText lines={4} />
            </div>
          }
        />
        <SkeletonCard>
          <SkeletonChart height={160} />
        </SkeletonCard>
      </SkeletonGroup>
    </>
  );
}

export function ThresholdRowsSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid gap-3 py-4 sm:grid-cols-[180px_1fr] sm:items-center">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-12" />
          </div>
          <Skeleton className="h-2 w-full !rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ProtocolsSkeleton() {
  return (
    <>
      <PageHeaderSkeleton eyebrow="System" title="Monitoring protocols" actions={0} />
      <SkeletonGroup label="Loading protocols" className="grid gap-4 lg:grid-cols-12">
        <SkeletonCard className="lg:col-span-8">
          <ThresholdRowsSkeleton />
        </SkeletonCard>
        <div className="space-y-3 lg:col-span-4">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} title={false}>
              <Skeleton className="mb-3 h-3.5 w-28" />
              <SkeletonText lines={3} />
            </SkeletonCard>
          ))}
        </div>
      </SkeletonGroup>
    </>
  );
}
