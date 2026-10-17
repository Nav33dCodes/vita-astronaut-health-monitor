"use client";

import clsx from "clsx";
import { Cpu, Database, Radio, Satellite } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { useApiHealth, useSystemStatus } from "@/lib/api/queries";
import { useEventRate } from "@/lib/realtime/hooks";
import { useEventLog, useLinkStatus, type LinkState } from "@/lib/realtime/store";
import { useNow } from "@/lib/time";

const LINK_TONE: Record<LinkState, string> = {
  connected: "text-nominal",
  connecting: "text-caution",
  reconnecting: "text-caution",
  disconnected: "text-critical",
};

function formatDuration(totalSeconds: number) {
  const d = Math.floor(totalSeconds / 86_400);
  const h = Math.floor((totalSeconds % 86_400) / 3_600);
  const m = Math.floor((totalSeconds % 3_600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

export default function SystemStatusPage() {
  const link = useLinkStatus();
  const health = useApiHealth();
  const status = useSystemStatus();
  const rate = useEventRate();
  const now = useNow();

  const apiUp = health.data?.healthy ?? false;
  const allNominal = apiUp && link.state === "connected";

  return (
    <>
      <PageHeader
        eyebrow="Ground segment"
        title="System status"
        subtitle="Health of the API, the real-time uplink and the telemetry source."
        action={
          <span
            className={clsx(
              "rounded-full border px-4 py-1.5 font-mono text-xs tracking-widest uppercase",
              allNominal ? "border-nominal/30 text-nominal" : "border-caution/40 text-caution",
            )}
          >
            {allNominal ? "All systems nominal" : "Degraded"}
          </span>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Subsystem icon={<Radio />} title="Real-time uplink" state={link.state} tone={LINK_TONE[link.state]}>
          <Row label="Protocol" value="SignalR" />
          <Row label="Transport" value={link.transport ?? "—"} />
          <Row label="Round-trip" value={link.latencyMs !== null ? `${link.latencyMs} ms` : "—"} />
          <Row label="Connected for" value={link.connectedAt && now ? formatDuration((now.getTime() - link.connectedAt) / 1000) : "—"} />
          <Row label="Reconnects" value={String(link.reconnects)} />
          <Row label="Connection" value={link.connectionId ? `${link.connectionId.slice(0, 10)}…` : "—"} />
        </Subsystem>

        <Subsystem
          icon={<Database />}
          title="REST API"
          state={health.isPending ? "checking" : apiUp ? "healthy" : "unreachable"}
          tone={health.isPending ? "text-caution" : apiUp ? "text-nominal" : "text-critical"}
        >
          <Row label="Endpoint" value="/api/v1" />
          <Row label="Readiness" value={health.data?.status ?? (health.isError ? "Unreachable" : "—")} />
          <Row label="Probe latency" value={health.data ? `${health.data.latencyMs} ms` : "—"} />
          <Row label="Database" value={status.data?.database ?? "—"} />
          <Row label="Version" value={status.data?.version ?? "—"} />
          <Row label="Environment" value={status.data?.environment ?? "—"} />
        </Subsystem>

        <Subsystem
          icon={<Cpu />}
          title="Server"
          state={status.data ? "running" : "unknown"}
          tone={status.data ? "text-nominal" : "text-muted"}
        >
          <Row label="Uptime" value={status.data ? formatDuration(status.data.uptimeSeconds) : "—"} />
          <Row label="Server time" value={status.data ? new Date(status.data.serverTimeUtc).toISOString().slice(11, 19) + " UTC" : "—"} />
          <Row label="Live clients" value={status.data ? String(status.data.realtimeClients) : "—"} />
          <Row label="Hub" value={status.data?.realtimeHub ?? "—"} />
        </Subsystem>

        <Subsystem
          icon={<Satellite />}
          title="Telemetry source"
          state={status.data?.simulator.enabled ? "simulator" : "external"}
          tone="text-accent"
        >
          <Row label="Mode" value={status.data?.simulator.enabled ? "Sensor simulator" : "Manual / sensors"} />
          <Row label="Cadence" value={status.data?.simulator.enabled ? `${status.data.simulator.intervalSeconds}s / crew` : "—"} />
          <Row label="Packets / min" value={String(rate)} />
        </Subsystem>
      </div>

      <Card className="mt-4">
        <CardTitle>Uplink throughput · last 5 minutes</CardTitle>
        <ThroughputChart />
      </Card>
    </>
  );
}

function Subsystem({
  icon,
  title,
  state,
  tone,
  children,
}: {
  icon: ReactNode;
  title: string;
  state: string;
  tone: string;
  children: ReactNode;
}) {
  return (
    <Card hud className="p-5">
      <div className="flex items-start justify-between">
        <span className="grid size-10 place-items-center rounded-xl border border-line bg-overlay/[0.03] text-accent [&_svg]:size-5">
          {icon}
        </span>
        <span className={clsx("flex items-center gap-1.5 font-mono text-[10.5px] uppercase", tone)}>
          <span aria-hidden className="size-1.5 animate-blink rounded-full bg-current shadow-[0_0_8px_currentColor]" />
          {state}
        </span>
      </div>
      <h2 className="mt-4 font-semibold text-ink">{title}</h2>
      <dl className="mt-3 space-y-1.5">{children}</dl>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-mono text-ink">{value}</dd>
    </div>
  );
}

const BUCKET_SECONDS = 10;
const BUCKETS = 30;

/** Events per 10-second bucket, derived from the in-memory event log. */
function ThroughputChart() {
  const events = useEventLog();
  const now = useNow(2000);
  if (!now) return <div className="h-40" />;

  const end = now.getTime();
  const counts = Array.from({ length: BUCKETS }, () => ({ readings: 0, alerts: 0 }));
  for (const e of events) {
    const index = BUCKETS - 1 - Math.floor((end - e.at) / (BUCKET_SECONDS * 1000));
    if (index < 0) break; // newest first — everything after is older
    if (index < BUCKETS) counts[index][e.kind === "reading" ? "readings" : "alerts"]++;
  }
  const peak = Math.max(1, ...counts.map((c) => c.readings + c.alerts));

  return (
    <div>
      <div className="flex h-40 items-end gap-1" role="img" aria-label="Events per 10 seconds over the last five minutes">
        {counts.map((c, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`${c.readings} readings, ${c.alerts} alerts`}>
            {c.alerts > 0 && <div className="rounded-t-sm bg-critical" style={{ height: `${(c.alerts / peak) * 100}%` }} />}
            <div
              className={clsx("bg-accent/70", c.alerts === 0 && "rounded-t-sm")}
              style={{ height: `${(c.readings / peak) * 100}%`, minHeight: c.readings ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
        <span>−5 min</span>
        <span className="flex gap-4">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-accent/70" /> telemetry
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-critical" /> alerts
          </span>
        </span>
        <span>now</span>
      </div>
    </div>
  );
}
