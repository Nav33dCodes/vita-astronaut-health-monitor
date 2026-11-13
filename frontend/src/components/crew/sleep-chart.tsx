"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WellnessEntry } from "@/lib/api/types";
import { useThemeColors } from "@/lib/theme";
import { SLEEP_CAUTION, SLEEP_CRITICAL, dayLabel } from "./sleep-constants";

/** Nightly sleep bars, coloured against the caution and critical lines. */
export function SleepChart({ entries }: { entries: WellnessEntry[] }) {
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
