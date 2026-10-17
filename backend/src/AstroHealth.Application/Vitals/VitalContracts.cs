using AstroHealth.Application.Alerts;
using AstroHealth.Domain.Vitals;

namespace AstroHealth.Application.Vitals;

public sealed record VitalReadingResponse(
    Guid Id,
    Guid AstronautId,
    DateTimeOffset RecordedAtUtc,
    int HeartRateBpm,
    int SystolicMmHg,
    int DiastolicMmHg,
    decimal OxygenSaturationPct,
    decimal BodyTemperatureC,
    int RespiratoryRatePerMin,
    decimal RadiationDoseMsv,
    string? Notes,
    int EarlyWarningScore,
    EarlyWarningRisk EarlyWarningRisk)
{
    public static VitalReadingResponse From(VitalReading r)
    {
        var ews = Domain.Vitals.EarlyWarningScore.Calculate(r);
        return new VitalReadingResponse(
            r.Id, r.AstronautId, r.RecordedAtUtc, r.HeartRateBpm, r.SystolicMmHg, r.DiastolicMmHg,
            r.OxygenSaturationPct, r.BodyTemperatureC, r.RespiratoryRatePerMin, r.RadiationDoseMsv, r.Notes,
            ews.Score, ews.Risk);
    }
}

public sealed record RecordVitalsRequest(
    int HeartRateBpm,
    int SystolicMmHg,
    int DiastolicMmHg,
    decimal OxygenSaturationPct,
    decimal BodyTemperatureC,
    int RespiratoryRatePerMin,
    decimal RadiationDoseMsv,
    DateTimeOffset? RecordedAtUtc = null,
    string? Notes = null);

public sealed record RecordVitalsResponse(VitalReadingResponse Reading, IReadOnlyList<AlertResponse> RaisedAlerts);

public sealed record VitalsQuery(
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    int Page = 1,
    int PageSize = 100);

public sealed record MetricStats(VitalMetric Metric, decimal Min, decimal Max, decimal Average, decimal Latest);

public sealed record VitalStatsResponse(
    Guid AstronautId,
    int WindowHours,
    int ReadingCount,
    decimal TotalRadiationMsv,
    IReadOnlyList<MetricStats> Metrics);

/// <summary>Real-time event pushed to monitoring clients whenever a reading is stored.</summary>
public sealed record ReadingRecordedEvent(VitalReadingResponse Reading, string AstronautName, Guid? MissionId);

/// <summary>One downsampled bucket. Metric names match <see cref="VitalReadingResponse"/> so clients can reuse accessors.</summary>
public sealed record VitalSeriesPoint(
    DateTimeOffset RecordedAtUtc,
    int Samples,
    decimal HeartRateBpm,
    decimal SystolicMmHg,
    decimal DiastolicMmHg,
    decimal OxygenSaturationPct,
    decimal BodyTemperatureC,
    decimal RespiratoryRatePerMin,
    decimal RadiationDoseMsv);

public sealed record VitalSeriesResponse(
    Guid AstronautId,
    int WindowHours,
    int BucketSeconds,
    int RawSampleCount,
    IReadOnlyList<VitalSeriesPoint> Points);

public sealed record AstronautTelemetry(Guid AstronautId, IReadOnlyList<VitalReadingResponse> Readings);

/// <summary>Recent raw telemetry for many astronauts in one round-trip (live monitor bootstrap).</summary>
public sealed record TelemetrySnapshotResponse(
    DateTimeOffset GeneratedAtUtc,
    int WindowMinutes,
    IReadOnlyList<AstronautTelemetry> Crew);

public sealed record ThresholdResponse(
    VitalMetric Metric,
    string Label,
    string Unit,
    decimal? WarningLow,
    decimal? WarningHigh,
    decimal? CriticalLow,
    decimal? CriticalHigh);
