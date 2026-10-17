"use client";

import { Globe2, Moon, Orbit, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { MissionForm } from "@/components/missions/mission-form";
import { CrewAvatar } from "@/components/ui/avatar";
import { MissionStatusBadge } from "@/components/ui/badges";
import { Pager } from "@/components/ui/pager";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Button, Card, EmptyState, ErrorState, PageHeader, Select, Skeleton } from "@/components/ui/primitives";
import { useAstronauts, useChangeMissionStatus, useDeleteMission, useMissions } from "@/lib/api/queries";
import type { Mission, MissionDestination, MissionStatus } from "@/lib/api/types";
import { DESTINATION_LABELS, formatDate } from "@/lib/format";
import { formatMet, useNow } from "@/lib/time";
import { usePagination } from "@/lib/use-pagination";

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
        eyebrow="Flight manifest"
        title="Missions"
        subtitle="Crewed missions and their medical rosters."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> New mission
          </Button>
        }
      />

      {missions.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : missions.isError ? (
        <ErrorState error={missions.error} onRetry={() => missions.refetch()} />
      ) : missions.data.length === 0 ? (
        <Card>
          <EmptyState title="No missions yet" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            if (created) toast.success(`Mission ${created.name} created`);
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
  const onError = (error: Error) => toast.error("Action failed", { description: error.message });

  return (
    <Card hud={mission.status === "Active"} className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-accent/20 to-violet/10 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_250%,transparent)]">
          <Icon className="size-6" aria-hidden />
        </span>
        <MissionStatusBadge status={mission.status} />
      </div>

      <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">{mission.name}</h2>
      <p className="hud-label mt-1 !text-[9.5px]">
        {DESTINATION_LABELS[mission.destination]} · launch {formatDate(mission.launchDate)}
      </p>
      {mission.description && <p className="mt-3 line-clamp-2 text-sm text-muted">{mission.description}</p>}

      <div className="mt-4 rounded-xl border border-line bg-overlay/[0.02] px-4 py-3">
        <p className="hud-label !text-[9px]">Mission elapsed time</p>
        <p className="mt-0.5 font-mono text-lg tabular-nums text-accent">
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
          <span className="ml-3 font-mono text-xs text-muted">{mission.crewCount} crew</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Select
            value={mission.status}
            disabled={closed || changeStatus.isPending}
            onChange={(e) =>
              changeStatus.mutate(
                { id: mission.id, status: e.target.value as MissionStatus },
                { onSuccess: (m) => toast.success(`${m.name} is now ${m.status}`), onError },
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
            <span className="text-ink">{mission.name}</span> will be removed from the flight manifest.
          </>
        }
        confirmLabel="Delete mission"
        loading={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(mission.id, {
            onSuccess: () => {
              setConfirming(false);
              toast.success(`Mission ${mission.name} deleted`);
            },
            onError,
          })
        }
      />
    </Card>
  );
}
