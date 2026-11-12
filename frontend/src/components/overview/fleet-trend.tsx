"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Segmented } from "@/components/ui/primitives";
import type { Threshold, VitalMetric, VitalReading } from "@/lib/api/types";
import { useThemeColors } from "@/lib/theme";
import { METRIC_VALUE } from "@/lib/vitals";

type TrendMetric = Extract<VitalMetric, "HeartRate" | "OxygenSaturation" | "RespiratoryRate" | "BodyTemperature" | "SystolicPressure">;

const METRICS: { value: TrendMetric; label: string }[] = [
  { value: "HeartRate", label: "HR" },
  { value: "OxygenSaturation", label: "SpO₂" },
  { value: "SystolicPressure", label: "BP" },
  { value: "RespiratoryRate", label: "Resp" },
  { value: "BodyTemperature", label: "Temp" },
];

const BUCKET_MS = 30_000;

/**
 * Fleet-wide trend for one vital: crew average as a line, the crew's min–max spread as a band,
 * and the safe range behind it. One glance answers "is the whole crew drifting?".
 */
export function FleetTrend({ readings, thresholds }: { readings: Map<string, VitalReading[]>; thresholds: Threshold[] }) {
  const [metric, setMetric] = useState<TrendMetric>("HeartRate");
  const theme = useThemeColors();
  const threshold = thresholds.find((t) => t.metric === metric);
  const decimals = metric === "BodyTemperature" ? 1 : 0;

  const data = useMemo(() => {
    const buckets = new Map<number, number[]>();
    for (const list of readings.values()) {
      for (const r of list) {
        const t = Math.floor(new Date(r.recordedAtUtc).getTime() / BUCKET_MS) * BUCKET_MS;
        const bucket = buckets.get(t) ?? [];
        bucket.push(METRIC_VALUE[metric](r));
        buckets.set(t, bucket);
      }
    }
    const round = (v: number) => Number(v.toFixed(decimals));
    return [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .slice(-40)
      .map(([time, values]) => ({
        time,
        avg: round(values.reduce((s, v) => s + v, 0) / values.length),
        range: [Math.min(...values), Math.max(...values)] as [number, number],
        n: values.length,
      }));
  }, [readings, metric, decimals]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented size="sm" label="Vital sign" options={METRICS} value={metric} onChange={setMetric} />
        <div className="flex items-center gap-3 text-[12px] text-muted">
          <Legend swatch={<span className="h-0.5 w-3.5 rounded-full bg-accent" />}>Crew average</Legend>
          <Legend swatch={<span className="h-2.5 w-3.5 rounded-sm bg-accent/20" />}>Min–max</Legend>
          <Legend swatch={<span className="h-2.5 w-3.5 rounded-sm border border-dashed border-nominal/60 bg-nominal/10" />}>Safe range</Legend>
        </div>
      </div>

      <div className="min-h-[220px] flex-1">
        {data.length < 2 ? (
          <div className="grid h-full place-items-center text-[13px] text-muted">Collecting telemetry…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                stroke={theme.axis}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis stroke={theme.axis} fontSize={11} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={48} />
              {threshold && (
                <ReferenceArea
                  y1={threshold.warningLow ?? undefined}
                  y2={threshold.warningHigh ?? undefined}
                  fill={theme.nominal}
                  fillOpacity={0.06}
                  stroke={theme.nominal}
                  strokeOpacity={0.35}
                  strokeDasharray="3 4"
                  ifOverflow="extendDomain"
                />
              )}
              <Tooltip
                cursor={{ stroke: theme.line }}
                contentStyle={{
                  background: theme.panel,
                  border: `1px solid ${theme.line}`,
                  borderRadius: 10,
                  fontSize: 12,
                  boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.18)",
                  padding: "8px 10px",
                }}
                labelStyle={{ color: theme.muted, marginBottom: 4 }}
                itemStyle={{ color: theme.ink, padding: 0 }}
                labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString("en-GB")}
                formatter={(value, name) => {
                  const unit = threshold?.unit ?? "";
                  if (Array.isArray(value)) return [`${value[0]}–${value[1]} ${unit}`, "Range"];
                  return [`${value} ${unit}`, name === "avg" ? "Average" : name];
                }}
              />
              <Area dataKey="range" stroke="none" fill={theme.accent} fillOpacity={0.12} isAnimationActive={false} activeDot={false} />
              <Line
                dataKey="avg"
                stroke={theme.accent}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3.5, fill: theme.accent, stroke: theme.panel, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Legend({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <span className="hidden items-center gap-1.5 sm:flex">
      {swatch}
      {children}
    </span>
  );
}
