"use client";

import { Globe2, Moon, Orbit, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { confirm } from "@/lib/notify";
import { MissionForm } from "@/components/missions/mission-form";
import { CrewAvatar } from "@/components/ui/avatar";
import { MissionStatusBadge } from "@/components/ui/badges";
import { Pager } from "@/components/ui/pager";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Button, Card, EmptyState, ErrorState, PageHeader, Select } from "@/components/ui/primitives";
import { useAstronauts, useChangeMissionStatus, useDeleteMission, useMissions } from "@/lib/api/queries";
import type { Mission, MissionDestination, MissionStatus } from "@/lib/api/types";
import { DESTINATION_LABELS, formatDate } from "@/lib/format";
import { formatMet, useNow } from "@/lib/time";
import { usePagination } from "@/lib/use-pagination";
import { MissionsGridSkeleton } from "@/components/skeletons/page-skeletons";

const DESTINATION_ICONS: Record<MissionDestination, typeof Globe2> = {
  LowEarthOrbit: Globe2,
  Lunar: Moon,
  Mars: Orbit,
  DeepSpace: Orbit,
};

const PAGE_SIZE = 6;

const STATUSES: MissionStatus[] = ["Planned", "Active", "Completed", "Aborted"];

export default function MissionsPage() {
  const missions = useMissions();
  const [creating, setCreating] = useState(false);
  const { page, setPage, totalPages, pageItems, totalItems } = usePagination(missions.data ?? [], PAGE_SIZE);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Missions"
        subtitle="Crewed missions and their medical rosters."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> New mission
          </Button>
        }
      />

      {missions.isPending ? (
        <MissionsGridSkeleton />
      ) : missions.isError ? (
        <ErrorState error={missions.error} onRetry={() => missions.refetch()} />
      ) : missions.data.length === 0 ? (
        <Card>
          <EmptyState title="No missions yet" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
        </div>
      )}

      {missions.data && (
        <Pager
          className="mt-4"
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          itemLabel="missions"
          onPageChange={setPage}
        />
      )}

      <Dialog open={creating} onClose={() => setCreating(false)} title="New mission" description="Add a mission to the flight manifest.">
        <MissionForm
          onDone={(created) => {
            setCreating(false);
            if (created) confirm.done(`${created.name} created`);
          }}
        />
      </Dialog>
    </>
  );
}

function MissionCard({ mission }: { mission: Mission }) {
  const now = useNow();
  const crew = useAstronauts({ missionId: mission.id, pageSize: 12 });
  const changeStatus = useChangeMissionStatus();
  const remove = useDeleteMission();
  const [confirming, setConfirming] = useState(false);

  const Icon = DESTINATION_ICONS[mission.destination];
  const closed = mission.status === "Completed" || mission.status === "Aborted";
  const onError = (error: Error) => confirm.failed("Action failed", error.message);

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-panel-raised text-muted ring-1 ring-line ring-inset">
          <Icon className="size-5" aria-hidden />
        </span>
        <MissionStatusBadge status={mission.status} />
      </div>

      <h2 className="mt-4 text-[16px] font-semibold tracking-tight text-ink">{mission.name}</h2>
      <p className="mt-0.5 text-[12.5px] text-muted">
        {DESTINATION_LABELS[mission.destination]} · launch {formatDate(mission.launchDate)}
      </p>
      {mission.description && <p className="mt-3 line-clamp-2 text-[13px] text-muted">{mission.description}</p>}

      <div className="mt-4 rounded-lg bg-canvas px-3.5 py-2.5 ring-1 ring-line ring-inset">
        <p className="text-[12px] text-muted">Mission elapsed time</p>
        <p className="tnum mt-0.5 font-mono text-[15px] text-ink">
          {now ? formatMet(mission.launchDate, now) : "T+ --d --:--:--"}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
        <Link href="/crew" className="flex items-center" aria-label={`${mission.crewCount} crew`}>
          <div className="flex -space-x-2">
            {crew.data?.items.slice(0, 4).map((a) => (
              <CrewAvatar key={a.id} firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} size="sm" />
            ))}
          </div>
          <span className="ml-3 text-[12.5px] text-muted">{mission.crewCount} crew</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Select
            value={mission.status}
            disabled={closed || changeStatus.isPending}
            onChange={(e) =>
              changeStatus.mutate(
                { id: mission.id, status: e.target.value as MissionStatus },
                { onSuccess: (m) => confirm.done(`${m.name} is now ${m.status.toLowerCase()}`), onError },
              )
            }
            aria-label={`Status of ${mission.name}`}
            className="h-8 w-auto text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete ${mission.name}`}
            disabled={mission.crewCount > 0}
            title={mission.crewCount > 0 ? "Reassign crew before deleting" : "Delete mission"}
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Delete mission?"
        message={
          <>
            <span className="font-medium text-ink">{mission.name}</span> will be removed from the flight manifest.
          </>
        }
        confirmLabel="Delete mission"
        loading={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(mission.id, {
            onSuccess: () => {
              setConfirming(false);
              confirm.done(`${mission.name} deleted`);
            },
            onError,
          })
        }
      />
    </Card>
  );
}
