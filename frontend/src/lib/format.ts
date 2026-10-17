import type { CrewRole, MissionDestination, VitalMetric } from "./api/types";

/** "FlightEngineer" -> "Flight Engineer" */
export const humanize = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2");

export const ROLE_OPTIONS: CrewRole[] = [
  "Commander",
  "Pilot",
  "FlightEngineer",
  "MissionSpecialist",
  "MedicalOfficer",
  "PayloadSpecialist",
];

export const DESTINATION_LABELS: Record<MissionDestination, string> = {
  LowEarthOrbit: "Low Earth Orbit",
  Lunar: "Lunar",
  Mars: "Mars",
  DeepSpace: "Deep Space",
};

export const METRIC_LABELS: Record<VitalMetric, string> = {
  HeartRate: "Heart rate",
  SystolicPressure: "Systolic BP",
  DiastolicPressure: "Diastolic BP",
  OxygenSaturation: "SpO₂",
  BodyTemperature: "Temperature",
  RespiratoryRate: "Respiration",
  RadiationDose: "Radiation",
};

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const formatDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
