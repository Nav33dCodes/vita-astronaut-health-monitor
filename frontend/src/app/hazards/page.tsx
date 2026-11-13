"use client";

import clsx from "clsx";
import { ArrowUpRight, ExternalLink, Radio } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { HabitatPanel } from "@/components/hazards/habitat-panel";
import { HazardMatrix } from "@/components/hazards/hazard-matrix";
import { HazardSummaryRow } from "@/components/hazards/hazard-summary";
import { OnboardChecklist } from "@/components/hazards/onboard-actions";
import { RadiationBudgetBar } from "@/components/hazards/radiation-budget";
import { HEALTH_LABEL, HEALTH_TEXT, StatusDot } from "@/components/ui/badges";
import { Drawer } from "@/components/ui/dialog";
import { Card, CardTitle, EmptyState, ErrorState, PageHeader } from "@/components/ui/primitives";
import { useHazards } from "@/lib/api/queries";
import type { CrewHazards, MissionHazards, SpaceHazard } from "@/lib/api/types";
import { DESTINATION_LABELS } from "@/lib/format";
import { HAZARDS, HAZARD_META, formatSignalDelay } from "@/lib/hazards";
import { useHydrated } from "@/lib/hooks";
import { setMissionScope, useMissionScope } from "@/lib/mission-scope";
import { HazardsBodySkeleton } from "@/components/skeletons/page-skeletons";

export default function HazardsPage() {
  const hazards = useHazards();
  const hydrated = useHydrated();
  const [selected, setSelected] = useState<{ astronautId: string; hazard: SpaceHazard } | null>(null);

  const scope = useMissionScope();
  const missions = hazards.data?.missions.filter((m) => !scope || m.missionId === scope) ?? [];
  const crew = missions.flatMap((m) => m.crew.map((c) => ({ ...c, mission: m })));
  const selection = selected && crew?.find((c) => c.astronautId === selected.astronautId);

  return (
    <>
      <PageHeader
        eyebrow="Monitoring"
        title="Hazards"
        subtitle="The five hazards of human spaceflight identified by NASA's Human Research Program, monitored for every crew member in flight."
        action={
          <a
            href="https://www.nasa.gov/hrp/hazards/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-muted transition-colors hover:bg-overlay/[0.05] hover:text-ink"
          >
            NASA HRP hazards <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
      />

      {hazards.isPending || !hydrated ? (
        <HazardsBodySkeleton />
      ) : hazards.isError ? (
        <ErrorState error={hazards.error} onRetry={() => hazards.refetch()} />
      ) : missions.length === 0 ? (
        <Card>
          <EmptyState title={scope ? "The focused mission is not in flight" : "No mission in flight"}>
            {scope ? (
              <>
                Hazards are assessed for active missions.{" "}
                <button onClick={() => setMissionScope(null)} className="font-medium text-accent hover:underline">
                  Show all missions
                </button>
              </>
            ) : (
              "Hazards are assessed for crew on active missions."
            )}
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          <HazardSummaryRow summary={hazards.data.summary} />
          {missions.map((mission) => (
            <MissionSection key={mission.missionId} mission={mission} onSelect={(astronautId, hazard) => setSelected({ astronautId, hazard })} />
          ))}
          <AboutHazards />
        </div>
      )}

      <Drawer
        open={selection != null}
        onClose={() => setSelected(null)}
        width="30rem"
        title={selection ? `${selection.name} · ${HAZARD_META[selected!.hazard].short}` : "Hazard"}
        headerAction={
          selection && (
            <Link
              href={`/crew/${selection.astronautId}`}
              className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-overlay/[0.06] hover:text-ink"
            >
              Profile <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          )
        }
      >
        {selection && selected && <HazardDetail crew={selection} mission={selection.mission} hazard={selected.hazard} />}
      </Drawer>
    </>
  );
}

function MissionSection({ mission, onSelect }: { mission: MissionHazards; onSelect: (astronautId: string, hazard: SpaceHazard) => void }) {
  const independent = mission.communicationDelay.autonomy === "EarthIndependent";
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">{mission.name}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {DESTINATION_LABELS[mission.destination]} · day {mission.elapsedDays} · {mission.crew.length} crew
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-panel-raised px-2.5 text-muted ring-1 ring-line ring-inset">
            <Radio className="size-3.5" aria-hidden />
            Signal delay <span className="tnum font-medium text-ink">{formatSignalDelay(mission.communicationDelay)}</span>
          </span>
          <span
            className={clsx(
              "inline-flex h-7 items-center rounded-md px-2.5 font-medium ring-1 ring-inset",
              independent ? "bg-caution/[0.08] text-caution ring-caution/20" : "bg-panel-raised text-muted ring-line",
            )}
            title={independent ? "The crew must act on alerts without waiting for the ground" : "Real-time support from the ground is available"}
          >
            {independent ? "Earth-independent ops" : "Earth-supported"}
          </span>
        </div>
      </div>

      <div className="border-t border-line px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-ink">Cabin environment</h3>
          {mission.habitat && (
            <span className={clsx("inline-flex items-center gap-1.5 text-[12px] font-medium", HEALTH_TEXT[mission.habitat.status])}>
              <StatusDot status={mission.habitat.status} /> {HEALTH_LABEL[mission.habitat.status]}
            </span>
          )}
        </div>
        <HabitatPanel missionId={mission.missionId} />
      </div>

      <div className="border-t border-line">
        <h3 className="px-5 pt-4 pb-3 text-[13px] font-semibold text-ink">Crew exposure</h3>
        <HazardMatrix crew={mission.crew} onSelect={onSelect} />
      </div>
    </Card>
  );
}

/** Which checklist best answers a hazard's current finding. */
function playbookKeyFor(hazard: SpaceHazard, crew: CrewHazards, mission: MissionHazards): string | null {
  const status = crew.hazards.find((h) => h.hazard === hazard);
  switch (hazard) {
    case "SpaceRadiation":
      return "RadiationDose";
    case "IsolationAndConfinement":
      return status?.detail?.toLowerCase().includes("sleep") ? "SleepDebt" : "BehavioralHealth";
    case "GravityFields":
      return "HeartRate";
    case "HostileClosedEnvironments": {
      const finding = mission.habitat?.findings[0];
      return finding ? finding.metric : "OxygenSaturation";
    }
    default:
      return null;
  }
}

function HazardDetail({ crew, mission, hazard }: { crew: CrewHazards; mission: MissionHazards; hazard: SpaceHazard }) {
  const meta = HAZARD_META[hazard];
  const status = crew.hazards.find((h) => h.hazard === hazard)!;
  const playbookKey = playbookKeyFor(hazard, crew, mission);

  return (
    <div className="divide-y divide-line">
      <section className="px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-panel-raised text-muted ring-1 ring-line ring-inset">
            <meta.icon className="size-[18px]" aria-hidden />
          </span>
          <div>
            <p className="text-[14px] font-semibold text-ink">{meta.label}</p>
            <p className={clsx("flex items-center gap-1.5 text-[12.5px] font-medium", HEALTH_TEXT[status.status])}>
              <StatusDot status={status.status} /> {HEALTH_LABEL[status.status]}
            </p>
          </div>
        </div>
        <p className="mt-4 text-[14px] font-medium text-ink">{status.headline}</p>
        {status.detail && <p className="mt-1 text-[13px] text-muted">{status.detail}</p>}
        {hazard === "SpaceRadiation" && (
          <div className="mt-4">
            <RadiationBudgetBar budget={crew.radiation} />
          </div>
        )}
      </section>

      <section className="px-5 py-5">
        <h3 className="mb-3 text-[13px] font-semibold text-ink">Onboard actions</h3>
        {hazard === "DistanceFromEarth" ? (
          <p className="text-[13px] text-muted">
            One-way signal delay to {mission.name} is {formatSignalDelay(mission.communicationDelay)}.{" "}
            {mission.communicationDelay.autonomy === "EarthIndependent"
              ? "Every alert in VITA carries an onboard checklist, so the crew can act first and inform the ground afterwards."
              : "The ground can support the crew in near real time; onboard checklists remain available on every alert."}
          </p>
        ) : playbookKey ? (
          <OnboardChecklist playbookKey={playbookKey} />
        ) : null}
      </section>

      <section className="px-5 py-5">
        <h3 className="mb-2 text-[13px] font-semibold text-ink">About this hazard</h3>
        <p className="text-[13px] leading-relaxed text-muted">{meta.summary}</p>
        <p className="mt-3 text-[12.5px] font-medium text-ink">How VITA monitors it</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{meta.monitors}</p>
        <p className="mt-3 text-[12.5px] font-medium text-ink">Related NASA HRP risks</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-muted">
          {meta.risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AboutHazards() {
  return (
    <Card>
      <CardTitle description="NASA's Human Research Program groups the challenges of human spaceflight into five hazards. Each one feeds into the others, so VITA watches all five together.">
        The five hazards of human spaceflight
      </CardTitle>
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
        {HAZARDS.map((h) => {
          const meta = HAZARD_META[h];
          return (
            <div key={h} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-panel-raised text-muted ring-1 ring-line ring-inset">
                <meta.icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-ink">{meta.label}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{meta.summary}</p>
                <p className="mt-1.5 text-[12.5px] text-ink">
                  <span className="text-faint">VITA monitors: </span>
                  {meta.monitors}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
