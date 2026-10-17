"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Segmented } from "@/components/ui/primitives";
import type { Threshold, VitalMetric } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { useThemeColors } from "@/lib/theme";
import { METRIC_VALUE, type VitalSample } from "@/lib/vitals";

// Blood pressure is plotted as one chart with two series.
type ChartMetric = Exclude<VitalMetric, "DiastolicPressure">;

const CHART_METRICS: { value: ChartMetric; label: string }[] = [
  { value: "HeartRate", label: "HR" },
  { value: "SystolicPressure", label: "BP" },
  { value: "OxygenSaturation", label: "SpO₂" },
  { value: "BodyTemperature", label: "Temp" },
  { value: "RespiratoryRate", label: "Resp" },
  { value: "RadiationDose", label: "Rad" },
];

export function VitalsChart({ readings, thresholds }: { readings: VitalSample[]; thresholds: Threshold[] }) {
  const theme = useThemeColors();
  const COLORS = { primary: theme.accent, secondary: theme.violet, grid: theme.grid, axis: theme.axis };
  const [metric, setMetric] = useState<ChartMetric>("HeartRate");
  const threshold = thresholds.find((t) => t.metric === metric);
  const isBloodPressure = metric === "SystolicPressure";

  const data = useMemo(
    () =>
      readings.map((r) => ({
        time: new Date(r.recordedAtUtc).getTime(),
        value: METRIC_VALUE[metric](r),
        diastolic: r.diastolicMmHg,
      })),
    [readings, metric],
  );

  return (
    <div>
      <div className="mb-4">
        <Segmented label="Vital sign" options={CHART_METRICS} value={metric} onChange={setMetric} />
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="vital-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.3} />
                <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
              <filter id="vital-glow" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t: number) => new Date(t).toLocaleString("en", { weekday: "short", hour: "2-digit" })}
              stroke={COLORS.axis}
              fontSize={10}
              fontFamily="var(--font-geist-mono)"
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis
              stroke={COLORS.axis}
              fontSize={10}
              fontFamily="var(--font-geist-mono)"
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
            />
            {threshold && (
              <ReferenceArea
                y1={threshold.warningLow ?? undefined}
                y2={threshold.warningHigh ?? undefined}
                fill={theme.nominal}
                fillOpacity={0.07}
                stroke={theme.nominal}
                strokeOpacity={0.15}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
            )}
            <Tooltip
              cursor={{ stroke: COLORS.primary, strokeOpacity: 0.3 }}
              contentStyle={{
                background: theme.panel,
                border: `1px solid ${theme.line}`,
                borderRadius: 12,
                fontSize: 12,
                fontFamily: "var(--font-geist-mono)",
                boxShadow: "0 12px 32px -12px rgb(0 0 0 / 0.25)",
              }}
              labelStyle={{ color: theme.muted }}
              labelFormatter={(t) => formatDateTime(new Date(Number(t)).toISOString())}
              formatter={(value, name) => [`${value} ${threshold?.unit ?? ""}`, name]}
            />
            <Area
              type="monotone"
              dataKey="value"
              name={isBloodPressure ? "Systolic" : (threshold?.label ?? metric)}
              stroke={COLORS.primary}
              strokeWidth={2}
              fill="url(#vital-fill)"
              filter="url(#vital-glow)"
              dot={false}
              activeDot={{ r: 4, fill: COLORS.primary, stroke: theme.canvas, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            {isBloodPressure && (
              <Line
                type="monotone"
                dataKey="diastolic"
                name="Diastolic"
                stroke={COLORS.secondary}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {threshold && (
        <p className="hud-label mt-3 !text-[9px]">
          Dashed band · safe range for {threshold.label.toLowerCase()}
          {isBloodPressure && " (systolic)"}
        </p>
      )}
    </div>
  );
}
