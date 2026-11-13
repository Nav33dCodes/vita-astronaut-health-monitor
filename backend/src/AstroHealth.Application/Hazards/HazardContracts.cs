using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Hazards;
using AstroHealth.Domain.Missions;

namespace AstroHealth.Application.Hazards;

// ---- Habitat (hostile / closed environment) -----------------------------------------------

public sealed record RecordHabitatRequest(
    decimal CarbonDioxideMmHg,
    decimal OxygenPct,
    decimal CabinPressureKpa,
    decimal CabinTemperatureC,
    decimal HumidityPct,
    decimal RadiationDoseRateMsvPerDay,
    DateTimeOffset? RecordedAtUtc = null);

public sealed record HabitatFindingResponse(HabitatMetric Metric, HealthStatus Status, decimal Value, string Message);

public sealed record HabitatReadingResponse(
    Guid Id,
    Guid MissionId,
    DateTimeOffset RecordedAtUtc,
    decimal CarbonDioxideMmHg,
    decimal OxygenPct,
    decimal CabinPressureKpa,
    decimal CabinTemperatureC,
    decimal HumidityPct,
    decimal RadiationDoseRateMsvPerDay,
    HealthStatus Status,
    IReadOnlyList<HabitatFindingResponse> Findings)
{
    public static HabitatReadingResponse From(HabitatReading r)
    {
        var findings = HabitatEvaluator.Evaluate(r);
        return new HabitatReadingResponse(
            r.Id, r.MissionId, r.RecordedAtUtc, r.CarbonDioxideMmHg, r.OxygenPct, r.CabinPressureKpa,
            r.CabinTemperatureC, r.HumidityPct, r.RadiationDoseRateMsvPerDay,
            HabitatEvaluator.StatusOf(findings),
            findings.Select(f => new HabitatFindingResponse(f.Metric, f.Status, f.Value, f.Message)).ToList());
    }
}

public sealed record HabitatThresholdResponse(
    HabitatMetric Metric,
    string Label,
    string Unit,
    decimal? WarningLow,
    decimal? WarningHigh,
    decimal? CriticalLow,
    decimal? CriticalHigh);

/// <summary>Real-time event pushed whenever a habitat reading is stored.</summary>
public sealed record HabitatUpdatedEvent(HabitatReadingResponse Reading, string MissionName);

// ---- Wellness (isolation and confinement) -------------------------------------------------

public sealed record WellnessCheckInRequest(int Mood, int Stress, int Workload, string? Note = null);

public sealed record RecordActigraphyRequest(
    DateOnly Date,
    decimal SleepHours,
    int SleepEfficiencyPct,
    int ActiveMinutes,
    decimal LightExposureHours);

public sealed record WellnessEntryResponse(
    DateOnly Date,
    decimal SleepHours,
    int SleepEfficiencyPct,
    int ActiveMinutes,
    decimal LightExposureHours,
    int? Mood,
    int? Stress,
    int? Workload,
    string? CheckInNote,
    DateTimeOffset? CheckedInAtUtc)
{
    public static WellnessEntryResponse From(WellnessEntry e) => new(
        e.Date, e.SleepHours, e.SleepEfficiencyPct, e.ActiveMinutes, e.LightExposureHours,
        e.Mood, e.Stress, e.Workload, e.CheckInNote, e.CheckedInAtUtc);
}

public sealed record WellnessFindingResponse(HealthStatus Status, string Message);

public sealed record WellnessResponse(
    Guid AstronautId,
    int Days,
    decimal? AverageSleepHours,
    HealthStatus Status,
    IReadOnlyList<WellnessFindingResponse> Findings,
    IReadOnlyList<WellnessEntryResponse> Entries);

// ---- Five hazards overview ----------------------------------------------------------------

public sealed record HazardStatusResponse(SpaceHazard Hazard, HealthStatus Status, string Headline, string? Detail);

public sealed record RadiationBudgetResponse(
    decimal MissionDoseMsv,
    decimal CareerLimitMsv,
    decimal PercentOfLimit,
    decimal? CurrentRateMsvPerDay,
    int? DaysToLimitAtCurrentRate);

public sealed record CrewHazardsResponse(
    Guid AstronautId,
    string Name,
    CrewRole Role,
    HealthStatus Overall,
    RadiationBudgetResponse Radiation,
    IReadOnlyList<HazardStatusResponse> Hazards);

public sealed record CommunicationDelayResponse(double OneWayMinSeconds, double OneWayMaxSeconds, AutonomyLevel Autonomy);

public sealed record MissionHazardsResponse(
    Guid MissionId,
    string Name,
    MissionDestination Destination,
    int ElapsedDays,
    CommunicationDelayResponse CommunicationDelay,
    HabitatReadingResponse? Habitat,
    IReadOnlyList<CrewHazardsResponse> Crew);

public sealed record HazardSummaryResponse(SpaceHazard Hazard, HealthStatus Worst, int Critical, int Caution, int Nominal, int Unknown);

public sealed record HazardOverviewResponse(
    DateTimeOffset GeneratedAtUtc,
    IReadOnlyList<HazardSummaryResponse> Summary,
    IReadOnlyList<MissionHazardsResponse> Missions);

public sealed record PlaybookEntryResponse(string Key, string Title, SpaceHazard Hazard, string HrpRisk, IReadOnlyList<string> Steps);
