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
        eyebrow="Monitoring"
        title="Event log"
        subtitle={`Every message received over the real-time uplink this session. The last ${MAX_EVENTS} are kept in memory.`}
        action={
          <div className="flex gap-5 text-right">
            <div>
              <p className="text-[12px] text-muted">Rate</p>
              <p className="tnum text-[17px] font-semibold text-ink">{rate}/min</p>
            </div>
            <div>
              <p className="text-[12px] text-muted">Buffered</p>
              <p className="tnum text-[17px] font-semibold text-ink">{live.length}</p>
            </div>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
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
        <Button variant={frozen ? "primary" : "secondary"} className="sm:ml-auto" onClick={() => {
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
        <p className="mb-3 rounded-lg bg-caution/[0.08] px-4 py-2.5 text-[13px] text-caution ring-1 ring-caution/20 ring-inset">
          Stream paused{page > 1 ? " while you browse older events" : ""}.{" "}
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
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr className="text-left">
                  {["Time", "Type", "Astronaut", "Details"].map((h) => (
                    <th key={h} className="h-9 border-b border-line bg-canvas px-3 text-[12px] font-medium text-muted first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((e) => {
                  const meta = EVENT_META[e.kind];
                  return (
                    <tr key={e.id} className={clsx("group transition-colors hover:bg-overlay/[0.025]", e.kind === "alert-raised" && "bg-critical/[0.04]")}>
                      <td className="tnum border-b border-line py-2 pr-3 pl-5 font-mono text-[12px] whitespace-nowrap text-faint group-last:border-b-0">{formatClock(e.at)}</td>
                      <td className={clsx("border-b border-line px-3 py-2 whitespace-nowrap group-last:border-b-0", meta.className)}>
                        <meta.icon className="mr-1.5 inline size-3.5" aria-hidden />
                        {meta.label}
                      </td>
                      <td className="border-b border-line px-3 py-2 whitespace-nowrap group-last:border-b-0">
                        <Link href={`/crew/${e.astronautId}`} className="font-medium text-ink hover:underline">
                          {e.astronautName}
                        </Link>
                      </td>
                      <td className="border-b border-line py-2 pr-5 pl-3 text-muted group-last:border-b-0">{describeEvent(e)}</td>
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
