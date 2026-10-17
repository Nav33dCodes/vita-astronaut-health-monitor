import type { HealthStatus, Threshold, VitalMetric, VitalReading } from "./api/types";

/** Anything carrying vital metrics: a raw reading or a downsampled series point. */
export type VitalSample = Pick<
  VitalReading,
  | "recordedAtUtc"
  | "heartRateBpm"
  | "systolicMmHg"
  | "diastolicMmHg"
  | "oxygenSaturationPct"
  | "bodyTemperatureC"
  | "respiratoryRatePerMin"
  | "radiationDoseMsv"
>;

export const METRIC_VALUE: Record<VitalMetric, (r: VitalSample) => number> = {
  HeartRate: (r) => r.heartRateBpm,
  SystolicPressure: (r) => r.systolicMmHg,
  DiastolicPressure: (r) => r.diastolicMmHg,
  OxygenSaturation: (r) => r.oxygenSaturationPct,
  BodyTemperature: (r) => r.bodyTemperatureC,
  RespiratoryRate: (r) => r.respiratoryRatePerMin,
  RadiationDose: (r) => r.radiationDoseMsv,
};

/** Client-side mirror of the backend HealthEvaluator, for colouring values only. */
export function classify(value: number, t: Threshold | undefined): HealthStatus {
  if (!t) return "Unknown";
  if ((t.criticalLow !== null && value < t.criticalLow) || (t.criticalHigh !== null && value > t.criticalHigh)) {
    return "Critical";
  }
  if ((t.warningLow !== null && value < t.warningLow) || (t.warningHigh !== null && value > t.warningHigh)) {
    return "Caution";
  }
  return "Nominal";
}

export function describeRange(t: Threshold): string {
  if (t.warningLow !== null && t.warningHigh !== null) return `${t.warningLow}–${t.warningHigh} ${t.unit}`;
  if (t.warningLow !== null) return `≥ ${t.warningLow} ${t.unit}`;
  if (t.warningHigh !== null) return `≤ ${t.warningHigh} ${t.unit}`;
  return t.unit;
}
