"use client";

import clsx from "clsx";
import { Maximize2, Minimize2, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CrewQuickView } from "@/components/crew/crew-quick-view";
import { MonitorTile } from "@/components/monitor/monitor-tile";
import { Pager } from "@/components/ui/pager";
import { Button, Card, EmptyState, ErrorState, PageHeader, Segmented, Select } from "@/components/ui/primitives";
import { useAstronauts, useMissions, useThresholds } from "@/lib/api/queries";
import { useHydrated } from "@/lib/hooks";
import { setMissionScope, useMissionScope } from "@/lib/mission-scope";
import { useEventRate } from "@/lib/realtime/hooks";
import { useLinkStatus } from "@/lib/realtime/store";
import { usePagination } from "@/lib/use-pagination";
import { SEVERITY_RANK } from "@/lib/vitals";
import { MonitorTilesSkeleton } from "@/components/skeletons/page-skeletons";

type Sort = "severity" | "name";
type Scope = "active" | "all";

const TILES_PER_PAGE = 8;
const CYCLE_SECONDS = 15;

export default function LiveMonitorPage() {
  // Mission filter = the app-wide mission focus (sidebar switcher).
  const missionId = useMissionScope() ?? "";
  const [sort, setSort] = useState<Sort>("severity");
  const [scope, setScope] = useState<Scope>("active");
  const [selected, setSelected] = useState<string | null>(null);
  const [wall, setWall] = useState(false);

  const missions = useMissions();
  const crew = useAstronauts({ pageSize: 100, missionId: missionId || undefined });
  const thresholds = useThresholds();
  const link = useLinkStatus();
  const rate = useEventRate();
  // Cached data can be restored before hydration; keep the first client render identical to the server.
  const hydrated = useHydrated();

  const activeMissionIds = useMemo(() => new Set(missions.data?.filter((m) => m.status === "Active").map((m) => m.id)), [missions.data]);

  const roster = useMemo(() => {
    const items = (crew.data?.items ?? []).filter((a) => scope === "all" || (a.missionId !== null && activeMissionIds.has(a.missionId)));
    return items.sort((a, b) =>
      sort === "severity"
        ? SEVERITY_RANK[a.healthStatus] - SEVERITY_RANK[b.healthStatus] || a.lastName.localeCompare(b.lastName)
        : a.lastName.localeCompare(b.lastName),
    );
  }, [crew.data, scope, sort, activeMissionIds]);

  const { page, setPage, totalPages, pageItems, totalItems } = usePagination(roster, TILES_PER_PAGE);
  const [cycling, setCycling] = useState(false);

  // Wall-display mode: rotate through pages so every stream gets screen time.
  useEffect(() => {
    if (!cycling || totalPages <= 1) return;
    const timer = setInterval(() => setPage((p) => (p >= totalPages ? 1 : p + 1)), CYCLE_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [cycling, totalPages, setPage]);

  // Wall display = browser fullscreen; leaving fullscreen (Esc) leaves wall mode too.
  useEffect(() => {
    const onChange = () => setWall(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleWall = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().then(() => setCycling(true));
  };

  return (
    <>
      <PageHeader
        eyebrow="Monitoring"
        title="Live monitor"
        subtitle="Bedside-monitor view of every crew member, streamed in real time."
        action={
          <div className="flex items-center gap-5 text-right">
            <Stat label="Uplink" value={link.state === "connected" ? "Live" : "Reconnecting"} tone={link.state === "connected" ? "text-nominal" : "text-caution"} />
            <Stat label="Readings/min" value={String(rate)} />
            <Stat label="Streams" value={hydrated ? String(roster.length) : "–"} />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={missionId} onChange={(e) => setMissionScope(e.target.value || null)} aria-label="Filter by mission" className="w-auto min-w-40">
          <option value="">All missions</option>
          {missions.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Segmented
          label="Scope"
          options={[
            { value: "active", label: "In flight" },
            { value: "all", label: "All crew" },
          ]}
          value={scope}
          onChange={setScope}
        />
        <Segmented
          label="Sort"
          options={[
            { value: "severity", label: "Severity" },
            { value: "name", label: "Name" },
          ]}
          value={sort}
          onChange={setSort}
        />
        <div className="ml-auto flex gap-2">
          {totalPages > 1 && (
            <Button variant="secondary" onClick={() => setCycling(!cycling)} title={`Rotate pages every ${CYCLE_SECONDS}s`}>
              {cycling ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {cycling ? "Cycling" : "Auto-cycle"}
            </Button>
          )}
          <Button variant="secondary" onClick={toggleWall} title="Full-screen wall display">
            {wall ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
            <span className="hidden sm:inline">{wall ? "Exit wall mode" : "Wall mode"}</span>
          </Button>
        </div>
      </div>

      {crew.isPending || thresholds.isPending ? (
        <MonitorTilesSkeleton />
      ) : crew.isError ? (
        <ErrorState error={crew.error} onRetry={() => crew.refetch()} />
      ) : roster.length === 0 ? (
        <Card>
          <EmptyState title="No crew streaming">
            Only astronauts on an active mission transmit telemetry. Switch to “All crew” or activate a mission.
          </EmptyState>
        </Card>
      ) : (
        <div className={clsx("grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4", cycling && "animate-fade-in")} key={cycling ? page : undefined}>
          {pageItems.map((a) => (
            <MonitorTile key={a.id} astronaut={a} thresholds={thresholds.data ?? []} onSelect={setSelected} />
          ))}
        </div>
      )}

      <Pager
        className="mt-4"
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={TILES_PER_PAGE}
        itemLabel="streams"
        onPageChange={(p) => {
          setCycling(false); // manual navigation takes over from the rotation
          setPage(p);
        }}
      />

      <CrewQuickView astronautId={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function Stat({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[12px] text-muted">{label}</p>
      <p className={clsx("tnum text-[17px] font-semibold", tone)}>{value}</p>
    </div>
  );
}
