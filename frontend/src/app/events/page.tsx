"use client";

import clsx from "clsx";
import { Download, Pause, Play, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EVENT_META, describeEvent, formatClock } from "@/components/realtime/event-feed";
import { Pager } from "@/components/ui/pager";
import { Button, Card, EmptyState, Input, PageHeader, Segmented } from "@/components/ui/primitives";
import { useEventRate } from "@/lib/realtime/hooks";
import { MAX_EVENTS, clearEvents, useEventLog, useLinkStatus, type TelemetryEvent } from "@/lib/realtime/store";
import { usePagination } from "@/lib/use-pagination";

type KindFilter = "all" | "reading" | "alerts";

const PAGE_SIZE = 15;

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "reading", label: "Telemetry" },
  { value: "alerts", label: "Alerts" },
];

function toCsv(events: TelemetryEvent[]): string {
  const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const rows = events.map((e) =>
    [new Date(e.at).toISOString(), EVENT_META[e.kind].label, e.astronautName, describeEvent(e)].map(escape).join(","),
  );
  return ["timestamp,type,astronaut,details", ...rows].join("\n");
}

export default function EventLogPage() {
  const live = useEventLog();
  const link = useLinkStatus();
  const rate = useEventRate();

  const [frozen, setFrozen] = useState<TelemetryEvent[] | null>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");

  const source = frozen ?? live;
  const events = useMemo(() => {
    const term = search.trim().toLowerCase();
    return source.filter(
      (e) =>
        (kind === "all" || (kind === "reading" ? e.kind === "reading" : e.kind !== "reading")) &&
        (!term || e.astronautName.toLowerCase().includes(term) || describeEvent(e).toLowerCase().includes(term)),
    );
  }, [source, kind, search]);

  const { page, setPage, totalPages, pageItems, totalItems } = usePagination(events, PAGE_SIZE);

  // Older pages would shift as new events arrive, so browsing them pauses the stream.
  const changePage = (next: number) => {
    if (next > 1 && !frozen) setFrozen(live);
    if (next === 1 && frozen) setFrozen(null);
    setPage(next);
  };

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(events)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `telemetry-${new Date().toISOString()}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        eyebrow="Ground segment"
        title="Event Log"
        subtitle={`Every message received over the SignalR uplink this session (last ${MAX_EVENTS} kept in memory).`}
        action={
          <div className="flex gap-6 text-right font-mono">
            <div>
              <p className="hud-label !text-[9px]">Rate</p>
              <p className="text-xl font-semibold text-ink">{rate}/min</p>
            </div>
            <div>
              <p className="hud-label !text-[9px]">Buffered</p>
              <p className="text-xl font-semibold text-ink">{live.length}</p>
            </div>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by astronaut or message…"
            aria-label="Filter events"
            className="pl-9"
          />
        </div>
        <Segmented
          label="Event type"
          options={KIND_OPTIONS}
          value={kind}
          onChange={(value) => {
            setKind(value);
            setPage(1);
          }}
        />
        <Button variant={frozen ? "primary" : "secondary"} onClick={() => {
            setFrozen(frozen ? null : live);
            setPage(1);
          }}>
          {frozen ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          {frozen ? "Resume" : "Pause"}
        </Button>
        <Button variant="secondary" onClick={exportCsv} disabled={events.length === 0}>
          <Download className="size-4" aria-hidden /> CSV
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            clearEvents();
            setFrozen(null);
            setPage(1);
          }}
          aria-label="Clear event log"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      {frozen && (
        <p className="mb-3 rounded-xl border border-caution/30 bg-caution/10 px-4 py-2 font-mono text-xs text-caution">
          Stream paused{page > 1 ? " while you browse older events" : ""} —{" "}
          {live.length - frozen.length > 0 ? `${live.length - frozen.length} new events waiting` : "no new events yet"}.
        </p>
      )}

      <Card className="overflow-hidden p-0">
        {events.length === 0 ? (
          <EmptyState title={link.state === "connected" ? "Waiting for events" : "Uplink not connected"}>
            {link.state === "connected"
              ? "Events appear here the moment the server publishes them."
              : "The log fills once the SignalR connection is established."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Time", "Type", "Astronaut", "Details"].map((h) => (
                    <th key={h} className="hud-label px-4 py-3 !text-[9.5px] font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono text-xs">
                {pageItems.map((e) => {
                  const meta = EVENT_META[e.kind];
                  return (
                    <tr key={e.id} className={clsx("transition hover:bg-overlay/[0.03]", e.kind === "alert-raised" && "bg-critical/[0.05]")}>
                      <td className="px-4 py-2 whitespace-nowrap text-faint">{formatClock(e.at)}</td>
                      <td className={clsx("px-4 py-2 whitespace-nowrap", meta.className)}>
                        <meta.icon className="mr-1.5 inline size-3.5" aria-hidden />
                        {meta.label}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <Link href={`/crew/${e.astronautId}`} className="text-ink hover:text-accent">
                          {e.astronautName}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-muted">{describeEvent(e)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pager
        className="mt-4"
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={PAGE_SIZE}
        itemLabel="events"
        onPageChange={changePage}
      />
    </>
  );
}
