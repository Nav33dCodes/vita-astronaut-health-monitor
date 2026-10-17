"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MonitorTile } from "@/components/monitor/monitor-tile";
import { Pager } from "@/components/ui/pager";
import { Button, Card, EmptyState, ErrorState, PageHeader, Segmented, Select, Skeleton } from "@/components/ui/primitives";
import { useAstronauts, useMissions, useThresholds } from "@/lib/api/queries";
import type { HealthStatus } from "@/lib/api/types";
import { useEventRate } from "@/lib/realtime/hooks";
import { useLinkStatus } from "@/lib/realtime/store";
import { usePagination } from "@/lib/use-pagination";

type Sort = "severity" | "name";
type Scope = "active" | "all";

const TILES_PER_PAGE = 8;
const CYCLE_SECONDS = 15;

const SEVERITY_RANK: Record<HealthStatus, number> = { Critical: 0, Caution: 1, Nominal: 2, Unknown: 3 };

export default function LiveMonitorPage() {
  const [missionId, setMissionId] = useState("");
  const [sort, setSort] = useState<Sort>("severity");
  const [scope, setScope] = useState<Scope>("active");

  const missions = useMissions();
  const crew = useAstronauts({ pageSize: 100, missionId: missionId || undefined });
  const thresholds = useThresholds();
  const link = useLinkStatus();
  const rate = useEventRate();

  const activeMissionIds = useMemo(
    () => new Set(missions.data?.filter((m) => m.status === "Active").map((m) => m.id)),
    [missions.data],
  );

  const roster = useMemo(() => {
    const items = (crew.data?.items ?? []).filter(
      (a) => scope === "all" || (a.missionId !== null && activeMissionIds.has(a.missionId)),
    );
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

  return (
    <>
      <PageHeader
        eyebrow="Real-time telemetry"
        title="Live Monitor"
        subtitle="Bedside-monitor view of every crew member, streamed over SignalR."
        action={
          <div className="flex gap-6 text-right font-mono">
            <Stat label="Uplink" value={link.state === "connected" ? "LIVE" : link.state.toUpperCase()} tone={link.state === "connected" ? "text-nominal" : "text-caution"} />
            <Stat label="Packets/min" value={String(rate)} />
            <Stat label="Streams" value={String(roster.length)} />
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select value={missionId} onChange={(e) => setMissionId(e.target.value)} aria-label="Filter by mission" className="w-auto">
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
            { value: "severity", label: "By severity" },
            { value: "name", label: "By name" },
          ]}
          value={sort}
          onChange={setSort}
        />
        {totalPages > 1 && (
          <Button
            variant={cycling ? "primary" : "secondary"}
            size="sm"
            className="ml-auto"
            onClick={() => setCycling(!cycling)}
            title={`Rotate pages every ${CYCLE_SECONDS}s (wall display)`}
          >
            {cycling ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
            {cycling ? "Cycling" : "Auto-cycle"}
          </Button>
        )}
      </div>

      {crew.isPending || thresholds.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : crew.isError ? (
        <ErrorState error={crew.error} onRetry={() => crew.refetch()} />
      ) : roster.length === 0 ? (
        <Card>
          <EmptyState title="No crew streaming">
            Only astronauts on an active mission transmit telemetry. Switch to “All crew” or activate a mission.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {pageItems.map((a) => (
            <MonitorTile key={a.id} astronaut={a} thresholds={thresholds.data ?? []} />
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
    </>
  );
}

function Stat({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="hud-label !text-[9px]">{label}</p>
      <p className={`text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
