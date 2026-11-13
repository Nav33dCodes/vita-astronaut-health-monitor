"use client";

import clsx from "clsx";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { HEALTH_LABEL, HEALTH_TEXT, HealthBadge } from "@/components/ui/badges";
import { Button, Card, CardTitle, EmptyState, ErrorState, Field, Input, Skeleton } from "@/components/ui/primitives";
import { useWellness, useWellnessCheckIn } from "@/lib/api/queries";
import type { Wellness, WellnessEntry } from "@/lib/api/types";
import { useThemeColors } from "@/lib/theme";

const SLEEP_CAUTION = 6;
const SLEEP_CRITICAL = 5;

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Behavioural health for one crew member (the "isolation and confinement" hazard): two weeks of
 * wrist actigraphy plus the daily self-reported check-in.
 */
export function WellnessPanel({ astronautId, name }: { astronautId: string; name: string }) {
  const wellness = useWellness(astronautId, 14);

  if (wellness.isPending) return <Skeleton className="h-96 rounded-[var(--radius-card)]" />;
  if (wellness.isError) return <ErrorState error={wellness.error} onRetry={() => wellness.refetch()} />;

  const w = wellness.data;
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card className="lg:col-span-8">
        <CardTitle
          description="Hours of sleep per night from wrist actigraphy, last 14 nights."
          action={<HealthBadge status={w.status} />}
        >
          Sleep
        </CardTitle>
        {w.entries.some((e) => e.sleepHours > 0) ? <SleepChart entries={w.entries} /> : <EmptyState title="No actigraphy yet" />}
        <Findings wellness={w} />
      </Card>

      <Card className="lg:col-span-4">
        <CardTitle description={`How is ${name.split(" ")[0]} doing today?`}>Daily check-in</CardTitle>
        <CheckInForm astronautId={astronautId} today={w.entries[0]} />
      </Card>

      <Card className="overflow-hidden p-0 lg:col-span-12">
        <CardTitle className="mb-0 px-5 pt-4 pb-3" description="Actigraphy and self-reported scores (1 = very low, 5 = very high).">
          Daily log
        </CardTitle>
        <DailyLog entries={w.entries.slice(0, 7)} />
      </Card>
    </div>
  );
}

function SleepChart({ entries }: { entries: WellnessEntry[] }) {
  const theme = useThemeColors();
  const data = [...entries]
    .filter((e) => e.sleepHours > 0)
    .reverse()
    .map((e) => ({ day: dayLabel(e.date), hours: e.sleepHours, efficiency: e.sleepEfficiencyPct }));

  const colorOf = (h: number) => (h < SLEEP_CRITICAL ? theme.critical : h < SLEEP_CAUTION ? theme.caution : theme.accent);

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis dataKey="day" stroke={theme.axis} fontSize={11} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis stroke={theme.axis} fontSize={11} tickLine={false} axisLine={false} domain={[0, 9]} ticks={[0, 3, 6, 9]} />
          <ReferenceLine y={SLEEP_CAUTION} stroke={theme.caution} strokeDasharray="3 4" strokeOpacity={0.7} />
          <Tooltip
            cursor={{ fill: theme.grid }}
            contentStyle={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 10, fontSize: 12, padding: "8px 10px" }}
            labelStyle={{ color: theme.muted, marginBottom: 4 }}
            itemStyle={{ color: theme.ink, padding: 0 }}
            formatter={(value, _name, item) => [`${value} h · ${(item.payload as { efficiency: number }).efficiency}% efficient`, "Sleep"]}
          />
          <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.day} fill={colorOf(d.hours)} fillOpacity={d.hours < SLEEP_CAUTION ? 0.9 : 0.75} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Findings({ wellness }: { wellness: Wellness }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-[13px]">
      <span className="text-muted">
        Last 3 nights <span className="tnum font-semibold text-ink">{wellness.averageSleepHours?.toFixed(1) ?? "–"} h</span> average
      </span>
      <span className="flex items-center gap-1.5 text-[12px] text-faint">
        <span className="h-0 w-4 border-t border-dashed border-caution" aria-hidden /> {SLEEP_CAUTION} h caution line
      </span>
      {wellness.findings.map((f) => (
        <span key={f.message} className={clsx("font-medium", HEALTH_TEXT[f.status])}>
          {f.message}
        </span>
      ))}
    </div>
  );
}

const SCALE = [1, 2, 3, 4, 5];

function ScalePicker({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-ink">{label}</span>
        <span className="text-[11px] text-faint">
          {low} → {high}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={clsx(
              "tnum h-8 rounded-md text-[13px] font-medium ring-1 transition-colors ring-inset",
              value === n ? "bg-accent text-accent-ink ring-accent" : "bg-panel text-muted ring-line-strong hover:text-ink",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckInForm({ astronautId, today }: { astronautId: string; today: WellnessEntry | undefined }) {
  const checkIn = useWellnessCheckIn(astronautId);
  const isToday = today?.date === new Date().toISOString().slice(0, 10);
  const [mood, setMood] = useState(isToday && today?.mood ? today.mood : 3);
  const [stress, setStress] = useState(isToday && today?.stress ? today.stress : 3);
  const [workload, setWorkload] = useState(isToday && today?.workload ? today.workload : 3);
  const [note, setNote] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        checkIn.mutate(
          { mood, stress, workload, note: note || null },
          {
            onSuccess: (w) => {
              setNote("");
              toast.success("Check-in saved", { description: `Behavioural health: ${HEALTH_LABEL[w.status].toLowerCase()}` });
            },
            onError: (error) => toast.error("Check-in failed", { description: error.message }),
          },
        );
      }}
    >
      <ScalePicker label="Mood" value={mood} onChange={setMood} low="very low" high="very good" />
      <ScalePicker label="Stress" value={stress} onChange={setStress} low="calm" high="very high" />
      <ScalePicker label="Workload" value={workload} onChange={setWorkload} low="light" high="very heavy" />
      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Anything the flight surgeon should know" />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-faint">{isToday && today?.checkedInAtUtc ? "Updating today's check-in" : "Not checked in today"}</span>
        <Button type="submit" loading={checkIn.isPending}>
          Save check-in
        </Button>
      </div>
    </form>
  );
}

const TD = "border-b border-line px-3 py-2.5 compact:py-1.5 first:pl-5 last:pr-5 group-last:border-b-0";
const TH = "h-9 border-y border-line bg-canvas px-3 text-[12px] font-medium whitespace-nowrap text-muted first:pl-5 last:pr-5";

function Score({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-faint">—</span>;
  const bad = invert ? value >= 5 : value <= 1;
  const warn = invert ? value >= 4 : value <= 2;
  return <span className={clsx("tnum font-medium", bad ? "text-critical" : warn ? "text-caution" : "text-ink")}>{value}</span>;
}

function DailyLog({ entries }: { entries: WellnessEntry[] }) {
  if (entries.length === 0) return <EmptyState title="No entries yet" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="text-left">
            <th className={TH}>Day</th>
            <th className={clsx(TH, "text-right")}>Sleep</th>
            <th className={clsx(TH, "text-right")}>Efficiency</th>
            <th className={clsx(TH, "text-right")}>Active</th>
            <th className={clsx(TH, "text-right")}>Light</th>
            <th className={clsx(TH, "text-right")}>Mood</th>
            <th className={clsx(TH, "text-right")}>Stress</th>
            <th className={clsx(TH, "text-right")}>Workload</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.date} className="group">
              <td className={clsx(TD, "text-ink")}>{dayLabel(e.date)}</td>
              <td className={clsx(TD, "tnum text-right")}>
                {e.sleepHours > 0 ? (
                  <span className={e.sleepHours < SLEEP_CRITICAL ? "font-medium text-critical" : e.sleepHours < SLEEP_CAUTION ? "font-medium text-caution" : "text-ink"}>
                    {e.sleepHours.toFixed(1)} h
                  </span>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
              <td className={clsx(TD, "tnum text-right text-muted")}>{e.sleepHours > 0 ? `${e.sleepEfficiencyPct}%` : "—"}</td>
              <td className={clsx(TD, "tnum text-right text-muted")}>{e.activeMinutes > 0 ? `${e.activeMinutes} min` : "—"}</td>
              <td className={clsx(TD, "tnum text-right text-muted")}>{e.lightExposureHours > 0 ? `${e.lightExposureHours} h` : "—"}</td>
              <td className={clsx(TD, "text-right")}>
                <Score value={e.mood} />
              </td>
              <td className={clsx(TD, "text-right")}>
                <Score value={e.stress} invert />
              </td>
              <td className={clsx(TD, "text-right")}>
                <Score value={e.workload} invert />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
