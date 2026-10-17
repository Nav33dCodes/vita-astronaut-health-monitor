using AstroHealth.Application.Abstractions;
using AstroHealth.Application.Alerts;
using AstroHealth.Application.Common;
using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Common;
using AstroHealth.Domain.Vitals;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AstroHealth.Application.Vitals;

public interface IVitalService
{
    Task<Result<RecordVitalsResponse>> RecordAsync(Guid astronautId, RecordVitalsRequest request, CancellationToken ct);
    Task<Result<PagedResult<VitalReadingResponse>>> ListAsync(Guid astronautId, VitalsQuery query, CancellationToken ct);
    Task<Result<VitalStatsResponse>> GetStatsAsync(Guid astronautId, int windowHours, CancellationToken ct);
    Task<Result<VitalSeriesResponse>> GetSeriesAsync(Guid astronautId, int windowHours, int buckets, CancellationToken ct);
    Task<TelemetrySnapshotResponse> GetSnapshotAsync(int windowMinutes, int perAstronaut, Guid? missionId, CancellationToken ct);
    /// <summary>Latest reading of every astronaut in a single query (keyed by astronaut).</summary>
    Task<IReadOnlyDictionary<Guid, VitalReadingResponse>> GetLatestReadingsAsync(CancellationToken ct);
    IReadOnlyList<ThresholdResponse> GetThresholds();
}

internal sealed class VitalService(
    IAppDbContext db,
    ITelemetryPublisher publisher,
    TimeProvider clock,
    ILogger<VitalService> logger) : IVitalService
{
    public async Task<Result<RecordVitalsResponse>> RecordAsync(Guid astronautId, RecordVitalsRequest request, CancellationToken ct)
    {
        var astronaut = await db.Astronauts.AsNoTracking()
            .Where(a => a.Id == astronautId)
            .Select(a => new { a.FirstName, a.LastName, a.MissionId })
            .FirstOrDefaultAsync(ct);

        if (astronaut is null)
        {
            return AstronautErrors.NotFound(astronautId);
        }

        var reading = new VitalReading(
            astronautId,
            request.RecordedAtUtc?.ToUniversalTime() ?? clock.GetUtcNow(),
            request.HeartRateBpm,
            request.SystolicMmHg,
            request.DiastolicMmHg,
            request.OxygenSaturationPct,
            request.BodyTemperatureC,
            request.RespiratoryRatePerMin,
            request.RadiationDoseMsv,
            request.Notes);

        db.VitalReadings.Add(reading);

        var raised = await RaiseAlertsAsync(reading, ct);
        await db.SaveChangesAsync(ct);

        if (raised.Count > 0)
        {
            logger.LogWarning("Raised {AlertCount} health alert(s) for astronaut {AstronautId}", raised.Count, astronautId);
        }

        var name = $"{astronaut.FirstName} {astronaut.LastName}";
        var response = new RecordVitalsResponse(
            VitalReadingResponse.From(reading),
            raised.Select(alert => AlertResponse.From(alert, name)).ToList());

        // The data is committed; real-time fan-out must not depend on the caller still waiting.
        await publisher.ReadingRecordedAsync(new ReadingRecordedEvent(response.Reading, name, astronaut.MissionId), CancellationToken.None);
        foreach (var alert in response.RaisedAlerts)
        {
            await publisher.AlertRaisedAsync(alert, CancellationToken.None);
        }

        return response;
    }

    /// <summary>
    /// Raises an alert for each finding, unless an unresolved alert of equal or higher severity
    /// already exists for the same metric. This prevents alert floods while still escalating.
    /// </summary>
    private async Task<List<HealthAlert>> RaiseAlertsAsync(VitalReading reading, CancellationToken ct)
    {
        var findings = HealthEvaluator.Evaluate(reading);
        if (findings.Count == 0)
        {
            return [];
        }

        // Enums are stored as strings, so the max severity is computed in memory.
        var activeSeverities = (await db.HealthAlerts
                .Where(a => a.AstronautId == reading.AstronautId && a.Status != AlertStatus.Resolved)
                .Select(a => new { a.Metric, a.Severity })
                .ToListAsync(ct))
            .GroupBy(a => a.Metric)
            .ToDictionary(g => g.Key, g => g.Max(a => a.Severity));

        var alerts = findings
            .Where(f => !activeSeverities.TryGetValue(f.Metric, out var existing) || f.Severity > existing)
            .Select(f => HealthAlert.Raise(reading, f))
            .ToList();

        db.HealthAlerts.AddRange(alerts);
        return alerts;
    }

    public async Task<Result<PagedResult<VitalReadingResponse>>> ListAsync(Guid astronautId, VitalsQuery query, CancellationToken ct)
    {
        if (!await db.Astronauts.AnyAsync(a => a.Id == astronautId, ct))
        {
            return AstronautErrors.NotFound(astronautId);
        }

        var readings = db.VitalReadings.AsNoTracking().Where(r => r.AstronautId == astronautId);

        if (query.From is { } from)
        {
            readings = readings.Where(r => r.RecordedAtUtc >= from.ToUniversalTime());
        }

        if (query.To is { } to)
        {
            readings = readings.Where(r => r.RecordedAtUtc <= to.ToUniversalTime());
        }

        var page = await readings
            .OrderByDescending(r => r.RecordedAtUtc)
            .ToPagedResultAsync(query.Page, query.PageSize, ct);

        return new PagedResult<VitalReadingResponse>(
            page.Items.Select(VitalReadingResponse.From).ToList(), page.Page, page.PageSize, page.TotalCount);
    }

    public async Task<Result<VitalStatsResponse>> GetStatsAsync(Guid astronautId, int windowHours, CancellationToken ct)
    {
        if (!await db.Astronauts.AnyAsync(a => a.Id == astronautId, ct))
        {
            return AstronautErrors.NotFound(astronautId);
        }

        var since = clock.GetUtcNow().AddHours(-windowHours);
        var readings = await db.VitalReadings.AsNoTracking()
            .Where(r => r.AstronautId == astronautId && r.RecordedAtUtc >= since)
            .OrderBy(r => r.RecordedAtUtc)
            .ToListAsync(ct);

        if (readings.Count == 0)
        {
            return new VitalStatsResponse(astronautId, windowHours, 0, 0, []);
        }

        var metrics = Enum.GetValues<VitalMetric>()
            .Select(metric =>
            {
                var values = readings.Select(r => r.ValueOf(metric)).ToList();
                return new MetricStats(metric, values.Min(), values.Max(), Math.Round(values.Average(), 2), values[^1]);
            })
            .ToList();

        return new VitalStatsResponse(
            astronautId, windowHours, readings.Count, readings.Sum(r => r.RadiationDoseMsv), metrics);
    }

    /// <summary>
    /// Downsamples a time window into evenly sized buckets (mean per metric), so charts stay
    /// fast no matter how dense the raw telemetry is.
    /// </summary>
    public async Task<Result<VitalSeriesResponse>> GetSeriesAsync(Guid astronautId, int windowHours, int buckets, CancellationToken ct)
    {
        if (!await db.Astronauts.AnyAsync(a => a.Id == astronautId, ct))
        {
            return AstronautErrors.NotFound(astronautId);
        }

        var since = clock.GetUtcNow().AddHours(-windowHours);
        var bucketSeconds = Math.Max(1, (int)Math.Ceiling(windowHours * 3600.0 / buckets));

        // Recent history is raw; anything past the retention window survives only as hourly
        // rollups. Both become weighted samples so one bucketing pass covers the whole window.
        var raw = (await db.VitalReadings.AsNoTracking()
                .Where(r => r.AstronautId == astronautId && r.RecordedAtUtc >= since)
                .Select(r => new
                {
                    r.RecordedAtUtc, r.HeartRateBpm, r.SystolicMmHg, r.DiastolicMmHg,
                    r.OxygenSaturationPct, r.BodyTemperatureC, r.RespiratoryRatePerMin, r.RadiationDoseMsv
                })
                .ToListAsync(ct))
            .Select(r => new WeightedSample(
                r.RecordedAtUtc, 1, r.HeartRateBpm, r.SystolicMmHg, r.DiastolicMmHg,
                r.OxygenSaturationPct, r.BodyTemperatureC, r.RespiratoryRatePerMin, r.RadiationDoseMsv));

        var rolledUp = (await db.VitalRollups.AsNoTracking()
                .Where(r => r.AstronautId == astronautId && r.BucketStartUtc >= since)
                .ToListAsync(ct))
            .Select(r => new WeightedSample(
                r.BucketStartUtc.AddMinutes(30), r.Samples, r.AvgHeartRateBpm, r.AvgSystolicMmHg, r.AvgDiastolicMmHg,
                r.AvgOxygenSaturationPct, r.AvgBodyTemperatureC, r.AvgRespiratoryRatePerMin, r.AvgRadiationDoseMsv));

        var samples = raw.Concat(rolledUp).ToList();

        var points = samples
            .GroupBy(s => (long)(s.At - since).TotalSeconds / bucketSeconds)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                decimal total = g.Sum(s => s.Weight);
                decimal Mean(Func<WeightedSample, decimal> metric, int digits) =>
                    Math.Round(g.Sum(s => metric(s) * s.Weight) / total, digits);

                return new VitalSeriesPoint(
                    new DateTimeOffset((long)(g.Sum(s => (decimal)s.At.UtcTicks * s.Weight) / total), TimeSpan.Zero),
                    (int)total,
                    Mean(s => s.HeartRate, 1),
                    Mean(s => s.Systolic, 1),
                    Mean(s => s.Diastolic, 1),
                    Mean(s => s.OxygenSaturation, 2),
                    Mean(s => s.BodyTemperature, 2),
                    Mean(s => s.RespiratoryRate, 1),
                    Mean(s => s.RadiationDose, 4));
            })
            .ToList();

        return new VitalSeriesResponse(astronautId, windowHours, bucketSeconds, samples.Sum(s => s.Weight), points);
    }

    private sealed record WeightedSample(
        DateTimeOffset At,
        int Weight,
        decimal HeartRate,
        decimal Systolic,
        decimal Diastolic,
        decimal OxygenSaturation,
        decimal BodyTemperature,
        decimal RespiratoryRate,
        decimal RadiationDose);

    public async Task<TelemetrySnapshotResponse> GetSnapshotAsync(int windowMinutes, int perAstronaut, Guid? missionId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var since = now.AddMinutes(-windowMinutes);

        var readings = db.VitalReadings.AsNoTracking().Where(r => r.RecordedAtUtc >= since);
        if (missionId is not null)
        {
            readings = readings.Where(r => db.Astronauts.Any(a => a.Id == r.AstronautId && a.MissionId == missionId));
        }

        var rows = await readings.OrderBy(r => r.RecordedAtUtc).ToListAsync(ct);

        var crew = rows
            .GroupBy(r => r.AstronautId)
            .Select(g => new AstronautTelemetry(
                g.Key,
                g.TakeLast(perAstronaut).Select(VitalReadingResponse.From).ToList()))
            .ToList();

        return new TelemetrySnapshotResponse(now, windowMinutes, crew);
    }

    public async Task<IReadOnlyDictionary<Guid, VitalReadingResponse>> GetLatestReadingsAsync(CancellationToken ct)
    {
        // One correlated subquery (a LATERAL join on PostgreSQL) instead of a round-trip per astronaut.
        var latest = await db.Astronauts.AsNoTracking()
            .Select(a => a.Readings.OrderByDescending(r => r.RecordedAtUtc).FirstOrDefault())
            .Where(r => r != null)
            .ToListAsync(ct);

        return latest.ToDictionary(r => r!.AstronautId, r => VitalReadingResponse.From(r!));
    }

    public IReadOnlyList<ThresholdResponse> GetThresholds() =>
        HealthEvaluator.Thresholds
            .Select(t => new ThresholdResponse(
                t.Metric, t.Label, t.Unit, t.WarningLow, t.WarningHigh, t.CriticalLow, t.CriticalHigh))
            .ToList();
}
