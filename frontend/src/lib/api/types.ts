// Mirrors the AstroHealth API contracts (see backend Application layer).

export type HealthStatus = "Unknown" | "Nominal" | "Caution" | "Critical";
export type CrewRole =
  | "Commander"
  | "Pilot"
  | "FlightEngineer"
  | "MissionSpecialist"
  | "MedicalOfficer"
  | "PayloadSpecialist";
export type MissionStatus = "Planned" | "Active" | "Completed" | "Aborted";
export type MissionDestination = "LowEarthOrbit" | "Lunar" | "Mars" | "DeepSpace";
export type VitalMetric =
  | "HeartRate"
  | "SystolicPressure"
  | "DiastolicPressure"
  | "OxygenSaturation"
  | "BodyTemperature"
  | "RespiratoryRate"
  | "RadiationDose";
export type AlertSeverity = "Warning" | "Critical";
export type EarlyWarningRisk = "Low" | "LowMedium" | "Medium" | "High";
export type TrendDirection = "Rising" | "Falling";
export type TrendSeverity = "Info" | "Watch";
export type AlertStatus = "Open" | "Acknowledged" | "Resolved";

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Mission {
  id: string;
  name: string;
  description: string | null;
  destination: MissionDestination;
  status: MissionStatus;
  launchDate: string;
  endDate: string | null;
  crewCount: number;
}

export interface CreateMissionRequest {
  name: string;
  destination: MissionDestination;
  launchDate: string;
  description?: string | null;
}

export interface AstronautSummary {
  id: string;
  firstName: string;
  lastName: string;
  agency: string;
  role: CrewRole;
  missionId: string | null;
  missionName: string | null;
  healthStatus: HealthStatus;
  openAlerts: number;
  lastReadingAtUtc: string | null;
}

export interface AstronautDetail extends Omit<AstronautSummary, "lastReadingAtUtc"> {
  dateOfBirth: string;
  age: number;
  latestReading: VitalReading | null;
}

export interface AstronautQuery {
  search?: string;
  missionId?: string;
  status?: HealthStatus;
  page?: number;
  pageSize?: number;
}

export interface UpsertAstronautRequest {
  firstName: string;
  lastName: string;
  agency: string;
  role: CrewRole;
  dateOfBirth: string;
  missionId: string | null;
}

export interface VitalReading {
  id: string;
  astronautId: string;
  recordedAtUtc: string;
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  oxygenSaturationPct: number;
  bodyTemperatureC: number;
  respiratoryRatePerMin: number;
  radiationDoseMsv: number;
  notes: string | null;
  earlyWarningScore: number;
  earlyWarningRisk: EarlyWarningRisk;
}

export interface RecordVitalsRequest {
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  oxygenSaturationPct: number;
  bodyTemperatureC: number;
  respiratoryRatePerMin: number;
  radiationDoseMsv: number;
  recordedAtUtc?: string | null;
  notes?: string | null;
}

export interface RecordVitalsResponse {
  reading: VitalReading;
  raisedAlerts: Alert[];
}

export interface MetricStats {
  metric: VitalMetric;
  min: number;
  max: number;
  average: number;
  latest: number;
}

export interface VitalStats {
  astronautId: string;
  windowHours: number;
  readingCount: number;
  totalRadiationMsv: number;
  metrics: MetricStats[];
}

/** Downsampled bucket; metric fields share names with VitalReading. */
export interface VitalSeriesPoint {
  recordedAtUtc: string;
  samples: number;
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  oxygenSaturationPct: number;
  bodyTemperatureC: number;
  respiratoryRatePerMin: number;
  radiationDoseMsv: number;
}

export interface VitalSeries {
  astronautId: string;
  windowHours: number;
  bucketSeconds: number;
  rawSampleCount: number;
  points: VitalSeriesPoint[];
}

export interface SystemStatus {
  version: string;
  environment: string;
  serverTimeUtc: string;
  uptimeSeconds: number;
  realtimeClients: number;
  realtimeHub: string;
  database: string;
  simulator: { enabled: boolean; intervalSeconds: number };
  escalation: { enabled: boolean; criticalAckMinutes: number; warningAckMinutes: number; repeatMinutes: number; maxLevel: number };
  retention: { enabled: boolean; rawRetentionDays: number; rollupRetentionDays: number };
}

export interface TelemetrySnapshot {
  generatedAtUtc: string;
  windowMinutes: number;
  crew: { astronautId: string; readings: VitalReading[] }[];
}

/** SignalR payload for TelemetryHub.ReadingRecorded. */
export interface ReadingRecordedEvent {
  reading: VitalReading;
  astronautName: string;
  missionId: string | null;
}

export interface Threshold {
  metric: VitalMetric;
  label: string;
  unit: string;
  warningLow: number | null;
  warningHigh: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
}

export interface Alert {
  id: string;
  astronautId: string;
  astronautName: string;
  metric: VitalMetric;
  severity: AlertSeverity;
  status: AlertStatus;
  observedValue: number;
  message: string;
  raisedAtUtc: string;
  acknowledgedAtUtc: string | null;
  resolvedAtUtc: string | null;
  resolutionNote: string | null;
  /** 0 = not escalated. */
  escalationLevel: number;
  escalatedAtUtc: string | null;
}

export interface AlertQuery {
  status?: AlertStatus;
  severity?: AlertSeverity;
  astronautId?: string;
  escalated?: boolean;
  page?: number;
  pageSize?: number;
}

export interface DashboardSummary {
  activeMissions: number;
  totalCrew: number;
  crewHealth: { nominal: number; caution: number; critical: number; unknown: number };
  openAlerts: number;
  openCriticalAlerts: number;
  escalatedAlerts: number;
  readingsLast24Hours: number;
  recentAlerts: Alert[];
}

export interface ScoreComponent {
  metric: VitalMetric;
  value: number;
  points: number;
}

export interface Trend {
  metric: VitalMetric;
  direction: TrendDirection;
  changePerHour: number;
  currentValue: number;
  minutesToLimit: number | null;
  fitQuality: number;
  severity: TrendSeverity;
  message: string;
}

/** Early-warning score (adapted NEWS2) plus drift analysis over a recent window. */
export interface HealthAssessment {
  astronautId: string;
  astronautName: string;
  latestReadingAtUtc: string | null;
  score: number | null;
  risk: EarlyWarningRisk | null;
  components: ScoreComponent[];
  windowMinutes: number;
  sampleCount: number;
  trends: Trend[];
}

/** Early-warning scoring table published by the API (single source of truth). */
export interface EarlyWarningScoring {
  maxScore: number;
  mediumRiskFrom: number;
  highRiskFrom: number;
  parameters: { metric: VitalMetric; label: string; unit: string; bands: { range: string; points: number }[] }[];
}
