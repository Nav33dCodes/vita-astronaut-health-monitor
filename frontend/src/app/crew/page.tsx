"use client";

import clsx from "clsx";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AstronautForm } from "@/components/crew/astronaut-form";
import { CrewCard } from "@/components/crew/crew-card";
import { CrewAvatar } from "@/components/ui/avatar";
import { HealthBadge } from "@/components/ui/badges";
import { Dialog } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { Pager } from "@/components/ui/pager";
import { Button, Card, EmptyState, ErrorState, Input, PageHeader, Segmented, Select, Skeleton } from "@/components/ui/primitives";
import { useAstronauts, useMissions } from "@/lib/api/queries";
import type { HealthStatus } from "@/lib/api/types";
import { humanize, timeAgo } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks";
import { PAGE_SIZE } from "@/lib/prefetch";
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

const TH = "h-9 border-b border-line bg-canvas px-3 text-left text-[12px] font-medium whitespace-nowrap text-muted first:pl-5 last:pr-5";
const TD = "border-b border-line px-3 py-3 compact:py-2 first:pl-5 last:pr-5 group-last:border-b-0";

export default function CrewPage() {
  const router = useRouter();
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
        eyebrow="Operations"
        title="Crew"
        subtitle="Every astronaut under continuous health monitoring."
        action={
          <>
            <ExportMenu options={[reports.crewExcel(), reports.fleetPdf()]} />
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden /> Add astronaut
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            value={search}
            onChange={(e) => withReset(setSearch)(e.target.value)}
            placeholder="Search name or agency…"
            aria-label="Search crew"
            className="pl-9"
          />
        </div>
        <Select value={missionId} onChange={(e) => withReset(setMissionId)(e.target.value)} aria-label="Filter by mission" className="w-auto min-w-40">
          <option value="">All missions</option>
          {missions.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Segmented label="Health status" options={STATUS_OPTIONS} value={status} onChange={withReset(setStatus)} />
        <div className="ml-auto flex h-9 rounded-lg bg-panel-raised p-0.5 ring-1 ring-line ring-inset" role="group" aria-label="View">
          {(
            [
              ["table", List, "Table view"],
              ["grid", LayoutGrid, "Card view"],
            ] as const
          ).map(([mode, Icon, label]) => (
            <button
              key={mode}
              aria-label={label}
              title={label}
              aria-pressed={view === mode}
              onClick={() => withReset(setView)(mode)}
              className={clsx(
                "grid w-8 place-items-center rounded-md transition-colors",
                view === mode ? "bg-panel text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--color-line)]" : "text-muted hover:text-ink",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {crew.isPending ? (
        <Skeleton className="h-96 rounded-[var(--radius-card)]" />
      ) : crew.isError ? (
        <ErrorState error={crew.error} onRetry={() => crew.refetch()} />
      ) : crew.data.items.length === 0 ? (
        <Card>
          <EmptyState title="No astronauts match these filters">Try a different search or clear the filters.</EmptyState>
        </Card>
      ) : view === "grid" ? (
        <div className={clsx("grid gap-3 transition-opacity sm:grid-cols-2 xl:grid-cols-3", crew.isPlaceholderData && "opacity-60")}>
          {crew.data.items.map((a) => (
            <CrewCard key={a.id} astronaut={a} />
          ))}
        </div>
      ) : (
        <Card className={clsx("overflow-hidden p-0 transition-opacity", crew.isPlaceholderData && "opacity-60")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr>
                  <th className={TH}>Astronaut</th>
                  <th className={TH}>Role</th>
                  <th className={TH}>Mission</th>
                  <th className={TH}>Health</th>
                  <th className={clsx(TH, "text-right")}>Open alerts</th>
                  <th className={clsx(TH, "text-right")}>Last reading</th>
                </tr>
              </thead>
              <tbody>
                {crew.data.items.map((a) => (
                  <tr
                    key={a.id}
                    tabIndex={0}
                    onClick={() => router.push(`/crew/${a.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && router.push(`/crew/${a.id}`)}
                    className="group cursor-pointer transition-colors hover:bg-overlay/[0.025] focus-visible:bg-overlay/[0.04] focus-visible:outline-none"
                  >
                    <td className={TD}>
                      <div className="flex items-center gap-3">
                        <CrewAvatar firstName={a.firstName} lastName={a.lastName} status={a.healthStatus} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">
                            {a.firstName} {a.lastName}
                          </p>
                          <p className="truncate text-[12px] text-muted">{a.agency}</p>
                        </div>
                      </div>
                    </td>
                    <td className={clsx(TD, "text-muted")}>{humanize(a.role)}</td>
                    <td className={clsx(TD, "text-muted")}>{a.missionName ?? <span className="text-faint">Unassigned</span>}</td>
                    <td className={TD}>
                      <HealthBadge status={a.healthStatus} />
                    </td>
                    <td className={clsx(TD, "tnum text-right")}>
                      <span className={a.openAlerts > 0 ? "font-medium text-ink" : "text-faint"}>{a.openAlerts}</span>
                    </td>
                    <td className={clsx(TD, "text-right whitespace-nowrap text-muted")}>{timeAgo(a.lastReadingAtUtc)}</td>
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

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add astronaut" description="Register a crew member for medical monitoring.">
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
