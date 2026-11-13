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
  | "radiationDoseRateMsvPerDay"
>;

export const METRIC_VALUE: Record<VitalMetric, (r: VitalSample) => number> = {
  HeartRate: (r) => r.heartRateBpm,
  SystolicPressure: (r) => r.systolicMmHg,
  DiastolicPressure: (r) => r.diastolicMmHg,
  OxygenSaturation: (r) => r.oxygenSaturationPct,
  BodyTemperature: (r) => r.bodyTemperatureC,
  RespiratoryRate: (r) => r.respiratoryRatePerMin,
  RadiationDose: (r) => r.radiationDoseRateMsvPerDay ?? 0,
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

const SEVERITY_ORDER: HealthStatus[] = ["Unknown", "Nominal", "Caution", "Critical"];

/** The more severe of two statuses. */
export const worstStatus = (a: HealthStatus, b: HealthStatus): HealthStatus =>
  SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;

/** Sort rank: critical first, no data last. */
export const SEVERITY_RANK: Record<HealthStatus, number> = { Critical: 0, Caution: 1, Nominal: 2, Unknown: 3 };

/** Classifies one metric of a reading against the published thresholds. */
export function statusOf(metric: VitalMetric, reading: VitalSample | undefined, thresholds: Threshold[]): HealthStatus {
  if (!reading) return "Unknown";
  return classify(METRIC_VALUE[metric](reading), thresholds.find((t) => t.metric === metric));
}

/** Blood pressure is judged by the worse of systolic and diastolic. */
export const bloodPressureStatus = (reading: VitalSample | undefined, thresholds: Threshold[]): HealthStatus =>
  worstStatus(statusOf("SystolicPressure", reading, thresholds), statusOf("DiastolicPressure", reading, thresholds));
