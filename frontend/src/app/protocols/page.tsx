"use client";

import { ArrowRight, Database, Layers, ShieldAlert, Siren, Stethoscope, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardTitle, ErrorState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useEarlyWarningScoring, useSystemStatus, useThresholds } from "@/lib/api/queries";
import type { EarlyWarningScoring, Threshold } from "@/lib/api/types";

export default function ProtocolsPage() {
  const thresholds = useThresholds();
  const scoring = useEarlyWarningScoring();
  const status = useSystemStatus();
  const escalation = status.data?.escalation;
  const retention = status.data?.retention;

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Monitoring protocols"
        subtitle="The reference ranges and alerting rules the ground segment applies to every reading."
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardTitle>Vital sign limits</CardTitle>
          {thresholds.isPending ? (
            <Skeleton className="h-96" />
          ) : thresholds.isError ? (
            <ErrorState error={thresholds.error} onRetry={() => thresholds.refetch()} />
          ) : (
            <div className="divide-y divide-line">
              {thresholds.data.map((t) => (
                <ThresholdRow key={t.metric} threshold={t} />
              ))}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-4 text-[12px] text-muted">
            <Legend className="bg-critical/70">Critical</Legend>
            <Legend className="bg-caution/70">Warning</Legend>
            <Legend className="bg-nominal/60">Safe range</Legend>
          </div>
        </Card>

        <div className="space-y-3 lg:col-span-4">
          <Policy icon={<Stethoscope />} title="Evaluation">
            Every reading is checked against all seven limits the moment it arrives. Values outside the safe range raise a{" "}
            <b className="text-caution">warning</b>; values beyond the critical limit raise a <b className="text-critical">critical</b> alert.
          </Policy>
          <Policy icon={<Layers />} title="De-duplication">
            While an alert for a metric is unresolved, repeat findings of the same or lower severity are suppressed — the
            console never floods during a sustained episode.
          </Policy>
          <Policy icon={<TrendingUp />} title="Severity escalation">
            A warning that worsens to critical always raises a new alert, even while the warning is still open.
          </Policy>
          <Policy icon={<Siren />} title="Unacknowledged escalation">
            {!escalation ? (
              <Skeleton className="h-12" />
            ) : !escalation.enabled ? (
              "Escalation is currently disabled on the server."
            ) : (
              <>
                An open <b className="text-critical">critical</b> alert not acknowledged within{" "}
                <b className="text-ink">{escalation.criticalAckMinutes} min</b> (warnings: {escalation.warningAckMinutes} min) escalates to
                level 1 — master alarm, alarm tone and desktop notification. Every further {escalation.repeatMinutes} min adds a level,
                up to {escalation.maxLevel}. Acknowledging stops it immediately.
              </>
            )}
          </Policy>
          <Policy icon={<Database />} title="Data retention">
            {!retention ? (
              <Skeleton className="h-10" />
            ) : (
              <>
                Raw telemetry is kept for <b className="text-ink">{retention.rawRetentionDays} days</b>, then rolled up into hourly
                aggregates kept for {retention.rollupRetentionDays} days — long-range charts keep working while storage stays bounded.
              </>
            )}
          </Policy>
          <Policy icon={<ShieldAlert />} title="Alert lifecycle">
            <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
              <span className="text-accent">Open</span>
              <ArrowRight className="size-3" />
              <span className="text-ink">Acknowledged</span>
              <ArrowRight className="size-3" />
              <span className="text-muted">Resolved</span>
            </span>
            <span className="mt-2 block">
              Crew health status follows the worst unresolved alert: Critical → Caution → Nominal. No readings yet means Unknown.
            </span>
          </Policy>
          <p className="px-1 text-[12px] leading-relaxed text-faint">
            Reference ranges are loosely based on NASA-STD-3001 crew health standards. Demo values — not for clinical use.
          </p>
        </div>
      </div>

      <Card className="mt-4">
        <CardTitle description="Adapted from NEWS2 (Royal College of Physicians).">Early warning score</CardTitle>
        {scoring.isPending ? (
          <Skeleton className="h-64" />
        ) : scoring.isError ? (
          <ErrorState error={scoring.error} onRetry={() => scoring.refetch()} />
        ) : (
          <EwsTable scoring={scoring.data} />
        )}
      </Card>
    </>
  );
}

const POINT_TEXT: Record<number, string> = {
  0: "text-nominal",
  1: "text-caution",
  2: "text-caution",
  3: "text-critical",
};

// Seven columns: 3 · 2 · 1 points below normal, 0 (normal), 1 · 2 · 3 points above normal.
const COLUMN_POINTS = [3, 2, 1, 0, 1, 2, 3];

/** Lays each parameter's bands (ordered low → high) out around its normal (0-point) band. */
function toColumns(bands: EarlyWarningScoring["parameters"][number]["bands"]): string[] {
  const cells = Array<string>(COLUMN_POINTS.length).fill("");
  const normal = bands.findIndex((b) => b.points === 0);
  bands.forEach((band, i) => {
    const column = i < normal ? 3 - band.points : i === normal ? 3 : 3 + band.points;
    cells[column] = band.range;
  });
  return cells;
}

function EwsTable({ scoring }: { scoring: EarlyWarningScoring }) {
  return (
    <>
      <p className="mb-4 max-w-3xl text-[13.5px] leading-relaxed text-muted">
        Each vital earns 0–3 points by how far it sits from normal; the sum (max {scoring.maxScore}) gives one number for overall
        deterioration. Total ≥ {scoring.highRiskFrom} is <b className="text-critical">high</b> risk, {scoring.mediumRiskFrom}–
        {scoring.highRiskFrom - 1} <b className="text-caution">medium</b>, and any single parameter scoring 3 is{" "}
        <b className="text-caution">low–medium</b> even when the total is low. Trends are detected separately by fitting a line through
        the last 60 minutes and projecting when a safe limit will be crossed.
      </p>
      <div className="overflow-x-auto">
        <table className="tnum w-full min-w-[640px] text-center text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2 text-left text-[12px] font-medium text-muted">Parameter</th>
              {COLUMN_POINTS.map((points, i) => (
                <th key={i} className={`py-2 ${POINT_TEXT[points]}`}>
                  {points}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {scoring.parameters.map((p) => (
              <tr key={p.metric}>
                <td className="py-2.5 text-left text-ink">
                  {p.label} <span className="text-[12px] text-muted">({p.unit})</span>
                </td>
                {toColumns(p.bands).map((cell, i) => (
                  <td key={i} className="py-2.5 text-muted">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ThresholdRow({ threshold: t }: { threshold: Threshold }) {
  // Domain spans a little beyond the outermost limits.
  const lo = t.criticalLow ?? t.warningLow ?? 0;
  const hi = t.criticalHigh ?? t.warningHigh ?? 100;
  const pad = (hi - lo) * 0.18;
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const zones = [
    { from: min, to: t.criticalLow ?? min, className: "bg-critical/70" },
    { from: t.criticalLow ?? min, to: t.warningLow ?? min, className: "bg-caution/70" },
    { from: t.warningLow ?? min, to: t.warningHigh ?? max, className: "bg-nominal/50" },
    { from: t.warningHigh ?? max, to: t.criticalHigh ?? max, className: "bg-caution/70" },
    { from: t.criticalHigh ?? max, to: max, className: "bg-critical/70" },
  ].filter((z) => z.to > z.from);

  const marks = [t.criticalLow, t.warningLow, t.warningHigh, t.criticalHigh].filter((v): v is number => v !== null);

  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[180px_1fr] sm:items-center">
      <div>
        <p className="text-[13.5px] font-medium text-ink">{t.label}</p>
        <p className="text-[12px] text-muted">{t.unit}</p>
      </div>
      <div>
        <div className="relative flex h-2 gap-px overflow-hidden rounded-full">
          {zones.map((z, i) => (
            <div key={i} className={z.className} style={{ width: `${pct(z.to) - pct(z.from)}%` }} />
          ))}
        </div>
        <div className="tnum relative mt-1.5 h-4 text-[11.5px] text-muted">
          {marks.map((v) => (
            <span key={v} className="absolute -translate-x-1/2" style={{ left: `${pct(v)}%` }}>
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Policy({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-1.5 flex items-center gap-2 text-muted [&_svg]:size-4">
        {icon}
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
      </div>
      <div className="text-[13px] leading-relaxed text-muted">{children}</div>
    </Card>
  );
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-5 rounded-full ${className}`} />
      {children}
    </span>
  );
}
