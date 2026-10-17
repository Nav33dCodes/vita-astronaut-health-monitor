"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { HealthStatus, Threshold } from "@/lib/api/types";
import { HEALTH_COLOR } from "./badges";

/**
 * Eases between successive values. It starts AT the value (no count-up from zero), so revisiting
 * a page shows numbers instantly and only real changes animate.
 */
export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const origin = from.current;
    if (origin === value) return;
    const start = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const progress = Math.min(1, (t - start) / 700);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(origin + (value - origin) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className="tabular-nums">{display.toFixed(decimals)}</span>;
}

/** Minimal SVG sparkline with a soft gradient fill. */
export function Sparkline({ values, color, height = 40 }: { values: number[]; color: string; height?: number }) {
  const id = useId();
  if (values.length < 2) return <div style={{ height }} />;

  const width = 120;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 3 - ((v - min) / range) * (height - 6),
  ]);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full overflow-visible" style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.28 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" style={{ stroke: color }} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.5} style={{ fill: color, filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

/** Donut showing how the crew splits across health states. */
export function StatusRing({
  segments,
  size = 168,
  children,
}: {
  segments: { status: HealthStatus; value: number }[];
  size?: number;
  children?: ReactNode;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 1 ? 4 : 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s, i, visible) => {
      const before = visible.slice(0, i).reduce((sum, v) => sum + v.value, 0);
      const length = total > 0 ? (s.value / total) * circumference : 0;
      return { ...s, offset: total > 0 ? (before / total) * circumference : 0, dash: Math.max(length - gap, 1) };
    });

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" style={{ stroke: "var(--color-track)" }} strokeWidth={stroke} />
        {arcs.map((s) => (
          <circle
            key={s.status}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={-s.offset}
            style={{
              stroke: HEALTH_COLOR[s.status],
              filter: `drop-shadow(0 0 6px color-mix(in srgb, ${HEALTH_COLOR[s.status]} 40%, transparent))`,
              transition: "stroke-dasharray .6s",
            }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** 270° radial gauge. */
export function RadialGauge({
  value,
  min,
  max,
  status,
  label,
  unit,
  decimals = 0,
}: {
  value: number;
  min: number;
  max: number;
  status: HealthStatus;
  label: string;
  unit: string;
  decimals?: number;
}) {
  const size = 148;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * 0.75;
  const progress = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const color = HEALTH_COLOR[status];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[135deg]" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            style={{ stroke: "var(--color-track)" }}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc * progress} ${circumference}`}
            style={{
              stroke: color,
              filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 55%, transparent))`,
              transition: "stroke-dasharray .8s ease-out",
            }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-mono text-2xl font-semibold" style={{ color }}>
              <AnimatedNumber value={value} decimals={decimals} />
            </p>
            <p className="font-mono text-[10px] text-muted">{unit}</p>
          </div>
        </div>
      </div>
      <p className="hud-label -mt-3">{label}</p>
    </div>
  );
}

/** Horizontal track showing where a value sits relative to its safe band. */
export function RangeBar({ value, threshold, status }: { value: number; threshold: Threshold; status: HealthStatus }) {
  const lo = threshold.criticalLow ?? threshold.warningLow ?? 0;
  const hi = threshold.criticalHigh ?? threshold.warningHigh ?? 100;
  const pad = (hi - lo) * 0.12;
  const domainMin = lo - pad;
  const domainMax = hi + pad;
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - domainMin) / (domainMax - domainMin)) * 100));

  const safeFrom = pct(threshold.warningLow ?? domainMin);
  const safeTo = pct(threshold.warningHigh ?? domainMax);

  return (
    <div className="relative mt-3 h-1.5 rounded-full bg-overlay/[0.06]" aria-hidden>
      <div className="absolute inset-y-0 rounded-full bg-nominal/25" style={{ left: `${safeFrom}%`, width: `${safeTo - safeFrom}%` }} />
      <div
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas"
        style={{ left: `${pct(value)}%`, background: HEALTH_COLOR[status], boxShadow: `0 0 8px ${HEALTH_COLOR[status]}` }}
      />
    </div>
  );
}
