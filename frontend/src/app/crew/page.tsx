"use client";

import clsx from "clsx";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AstronautForm } from "@/components/crew/astronaut-form";
import { CrewCard } from "@/components/crew/crew-card";
import { CrewAvatar } from "@/components/ui/avatar";
import { HealthBadge } from "@/components/ui/badges";
import { Dialog } from "@/components/ui/dialog";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
} from "@/components/ui/primitives";
import { useAstronauts, useMissions } from "@/lib/api/queries";
import type { HealthStatus } from "@/lib/api/types";
import { humanize, timeAgo } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks";
import { PAGE_SIZE } from "@/lib/prefetch";
import { ExportMenu } from "@/components/ui/export-menu";
import { Pager } from "@/components/ui/pager";
import { reports } from "@/lib/reports";

type View = "table" | "grid";

// Grid pages are 3×3; the denser table shows a few more rows.
const VIEW_PAGE_SIZE: Record<View, number> = { table: PAGE_SIZE.crewTable, grid: PAGE_SIZE.crewGrid };

const STATUS_OPTIONS: { value: HealthStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "Critical", label: "Critical" },
  { value: "Caution", label: "Caution" },
  { value: "Nominal", label: "Nominal" },
  { value: "Unknown", label: "No data" },
];

export default function CrewPage() {
  const [search, setSearch] = useState("");
  const [missionId, setMissionId] = useState("");
  const [status, setStatus] = useState<HealthStatus | undefined>();
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>("table");
  const [adding, setAdding] = useState(false);

  const debouncedSearch = useDebouncedValue(search);
  const missions = useMissions();
  const crew = useAstronauts({
    search: debouncedSearch || undefined,
    missionId: missionId || undefined,
    status,
    page,
    pageSize: VIEW_PAGE_SIZE[view],
  });

  const withReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  return (
    <>
      <PageHeader
        eyebrow="Medical roster"
        title="Crew"
        subtitle="Every astronaut under continuous health monitoring."
        action={
          <div className="flex gap-2">
            <ExportMenu options={[reports.crewExcel(), reports.fleetPdf()]} />
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden /> Add astronaut
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            value={search}
            onChange={(e) => withReset(setSearch)(e.target.value)}
            placeholder="Search name or agency…"
            aria-label="Search crew"
            className="pl-9"
          />
        </div>
        <Select
          value={missionId}
          onChange={(e) => withReset(setMissionId)(e.target.value)}
          aria-label="Filter by mission"
          className="w-auto"
        >
          <option value="">All missions</option>
          {missions.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Segmented label="Health status" options={STATUS_OPTIONS} value={status} onChange={withReset(setStatus)} />
        <div className="flex rounded-xl border border-line bg-canvas/50 p-1" role="group" aria-label="View">
          {(
            [
              ["table", List],
              ["grid", LayoutGrid],
            ] as const
          ).map(([mode, Icon]) => (
            <button
              key={mode}
              aria-label={`${mode} view`}
              aria-pressed={view === mode}
              onClick={() => withReset(setView)(mode)}
              className={clsx(
                "grid size-8 place-items-center rounded-lg transition",
                view === mode ? "bg-accent/15 text-accent" : "text-muted hover:text-ink",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {crew.isPending ? (
        <Skeleton className="h-96" />
      ) : crew.isError ? (
        <ErrorState error={crew.error} onRetry={() => crew.refetch()} />
      ) : crew.data.items.length === 0 ? (
        <Card>
          <EmptyState title="No astronauts match these filters" />
        </Card>
      ) : view === "grid" ? (
        <div className={clsx("grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3", crew.isPlaceholderData && "opacity-60")}>
          {crew.data.items.map((a) => (
            <CrewCard key={a.id} astronaut={a} />
          ))}
        </div>
      ) : (
        <Card className={clsx("overflow-hidden p-0 transition-opacity", crew.isPlaceholderData && "opacity-60")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Astronaut", "Role", "Mission", "Health", "Alerts", "Last reading"].map((h) => (
                    <th key={h} className="hud-label px-5 py-3.5 !text-[9.5px] font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {crew.data.items.map((a) => (
                  <tr key={a.id} className="group transition hover:bg-accent/[0.03]">
                    <td className="px-5 py-3.5">
                      <Link href={`/crew/${a.id}`} className="flex items-center gap-3">
                        <CrewAvatar firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} size="sm" />
                        <span>
                          <span className="block font-medium text-ink group-hover:text-accent">
                            {a.firstName} {a.lastName}
                          </span>
                          <span className="block text-xs text-muted">{a.agency}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-muted">{humanize(a.role)}</td>
                    <td className="px-5 py-3.5 text-muted">{a.missionName ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <HealthBadge status={a.healthStatus} />
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      <span className={a.openAlerts > 0 ? "text-caution" : "text-faint"}>{a.openAlerts}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-muted">{timeAgo(a.lastReadingAtUtc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {crew.data && (
        <Pager
          className="mt-4"
          page={crew.data.page}
          totalPages={crew.data.totalPages}
          totalItems={crew.data.totalCount}
          pageSize={VIEW_PAGE_SIZE[view]}
          itemLabel="astronauts"
          onPageChange={setPage}
          busy={crew.isPlaceholderData}
        />
      )}

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add astronaut"
        description="Register a crew member for medical monitoring."
      >
        <AstronautForm
          onDone={(created) => {
            setAdding(false);
            if (created) toast.success(`${created.firstName} ${created.lastName} added to the roster`);
          }}
        />
      </Dialog>
    </>
  );
}
