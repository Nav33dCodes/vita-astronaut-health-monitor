import { Atom, Globe2, Orbit, ShieldAlert, Users, type LucideIcon } from "lucide-react";
import type { HabitatMetric, HabitatReading, MissionHazards, SpaceHazard } from "./api/types";

/**
 * The five hazards of human spaceflight, as defined by NASA's Human Research Program, and how
 * VITA monitors each one. Order follows NASA's presentation.
 */
export const HAZARDS: SpaceHazard[] = [
  "SpaceRadiation",
  "IsolationAndConfinement",
  "DistanceFromEarth",
  "GravityFields",
  "HostileClosedEnvironments",
];

export const HAZARD_META: Record<
  SpaceHazard,
  { label: string; short: string; icon: LucideIcon; summary: string; monitors: string; risks: string[] }
> = {
  SpaceRadiation: {
    label: "Space radiation",
    short: "Radiation",
    icon: Atom,
    summary: "Invisible and cumulative. Beyond Earth's magnetic field, crews are exposed to galactic cosmic rays and solar particle events.",
    monitors: "Personal dosimeter rate, cabin area monitor, mission dose against the 600 mSv career limit.",
    risks: ["Radiation-induced cancer", "Acute exposure during solar particle events"],
  },
  IsolationAndConfinement: {
    label: "Isolation and confinement",
    short: "Isolation",
    icon: Users,
    summary: "Small groups living far from home for long periods face behavioural changes, sleep loss and team strain.",
    monitors: "Wrist actigraphy (sleep, activity, light exposure, as in ARCHeR on Artemis II) and daily mood, stress and workload check-ins.",
    risks: ["Behavioral changes and psychiatric disorders", "Inadequate sleep and irregular schedules", "Inadequate teamwork"],
  },
  DistanceFromEarth: {
    label: "Distance from Earth",
    short: "Distance",
    icon: Globe2,
    summary: "Medical care and support from Earth arrive later the further the crew travels; Mars is minutes away by radio.",
    monitors: "Signal delay per destination and onboard first-response checklists for every alert type.",
    risks: ["Inadequate systems operations support", "Delayed medical care"],
  },
  GravityFields: {
    label: "Gravity fields",
    short: "Gravity",
    icon: Orbit,
    summary: "Muscles, bones, heart, blood vessels and the inner ear all adapt to new gravity levels and again on return.",
    monitors: "Heart rate and blood pressure against safe ranges, and days spent in reduced gravity.",
    risks: ["Cardiovascular adaptations", "Spaceflight-induced bone changes", "Reduced cardiorespiratory and musculoskeletal fitness"],
  },
  HostileClosedEnvironments: {
    label: "Hostile and closed environments",
    short: "Environment",
    icon: ShieldAlert,
    summary: "The spacecraft is the crew's whole world: air, pressure, temperature and humidity must stay safe at all times.",
    monitors: "Cabin CO₂, oxygen, pressure, temperature and humidity, plus each crew member's blood oxygen.",
    risks: ["Hypoxia", "Decompression sickness", "Host-microorganism interactions"],
  },
};

export const HABITAT_VALUE: Record<HabitatMetric, (r: HabitatReading) => number> = {
  CarbonDioxide: (r) => r.carbonDioxideMmHg,
  Oxygen: (r) => r.oxygenPct,
  CabinPressure: (r) => r.cabinPressureKpa,
  CabinTemperature: (r) => r.cabinTemperatureC,
  Humidity: (r) => r.humidityPct,
  RadiationDoseRate: (r) => r.radiationDoseRateMsvPerDay,
};

export const HABITAT_SHORT: Record<HabitatMetric, string> = {
  CarbonDioxide: "CO₂",
  Oxygen: "O₂",
  CabinPressure: "Pressure",
  CabinTemperature: "Temperature",
  Humidity: "Humidity",
  RadiationDoseRate: "Dose rate",
};

/** "1.3 s", "3–22 min", "real time". */
export function formatSignalDelay(delay: MissionHazards["communicationDelay"]): string {
  const { oneWayMinSeconds: min, oneWayMaxSeconds: max } = delay;
  if (max < 1) return "real time";
  if (max < 60) return `${max.toFixed(1)} s`;
  const m = (s: number) => Math.round(s / 60);
  return min === max ? `${m(max)} min` : `${m(min)}–${m(max)} min`;
}
