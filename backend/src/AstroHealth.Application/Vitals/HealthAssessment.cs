using AstroHealth.Application.Abstractions;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Common;
using AstroHealth.Domain.Vitals;
using Microsoft.EntityFrameworkCore;

namespace AstroHealth.Application.Vitals;

public sealed record ScoreComponentResponse(VitalMetric Metric, decimal Value, int Points);

public sealed record TrendResponse(
    VitalMetric Metric,
    TrendDirection Direction,
    decimal ChangePerHour,
    decimal CurrentValue,
    int? MinutesToLimit,
    decimal FitQuality,
    TrendSeverity Severity,
    string Message);

/// <summary>Early-warning score from the latest reading plus drift analysis over a recent window.</summary>
public sealed record HealthAssessmentResponse(
    Guid AstronautId,
    string AstronautName,
    DateTimeOffset? LatestReadingAtUtc,
    int? Score,
    EarlyWarningRisk? Risk,
    IReadOnlyList<ScoreComponentResponse> Components,
    int WindowMinutes,
    int SampleCount,
    IReadOnlyList<TrendResponse> Trends);

public sealed record ScoreBandResponse(string Range, int Points);

public sealed record ScoredParameterResponse(VitalMetric Metric, string Label, string Unit, IReadOnlyList<ScoreBandResponse> Bands);

/// <summary>The early-warning scoring table, published so clients never hard-code it.</summary>
public sealed record EarlyWarningScoringResponse(
    int MaxScore,
    int MediumRiskFrom,
    int HighRiskFrom,
    IReadOnlyList<ScoredParameterResponse> Parameters)
{
    public static readonly EarlyWarningScoringResponse Current = new(
        EarlyWarningScore.MaxScore,
        EarlyWarningScore.MediumRiskFrom,
        EarlyWarningScore.HighRiskFrom,
        EarlyWarningScore.Parameters
            .Select(p => new ScoredParameterResponse(p.Metric, p.Label, p.Unit, p.Bands.Select(b => new ScoreBandResponse(b.Range, b.Points)).ToList()))
            .ToList());
}

public interface IHealthAssessmentService
{
    Task<Result<HealthAssessmentResponse>> AssessAsync(Guid astronautId, int windowMinutes, CancellationToken ct);

    /// <summary>Every astronaut with telemetry, most at-risk first.</summary>
    Task<IReadOnlyList<HealthAssessmentResponse>> AssessFleetAsync(int windowMinutes, CancellationToken ct);
}

internal sealed class HealthAssessmentService(IAppDbContext db, TimeProvider clock) : IHealthAssessmentService
{
    public async Task<Result<HealthAssessmentResponse>> AssessAsync(Guid astronautId, int windowMinutes, CancellationToken ct)
    {
        var fleet = await AssessAsync(windowMinutes, astronautId, ct);
        return fleet.Count == 1 ? fleet[0] : AstronautErrors.NotFound(astronautId);
    }

    public async Task<IReadOnlyList<HealthAssessmentResponse>> AssessFleetAsync(int windowMinutes, CancellationToken ct) =>
        (await AssessAsync(windowMinutes, null, ct))
            .Where(a => a.Score is not null)
            .OrderByDescending(a => a.Risk)
            .ThenByDescending(a => a.Score)
            .ThenByDescending(a => a.Trends.Count)
            .ToList();

    private async Task<List<HealthAssessmentResponse>> AssessAsync(int windowMinutes, Guid? only, CancellationToken ct)
    {
        var since = clock.GetUtcNow().AddMinutes(-windowMinutes);

        var astronauts = await db.Astronauts.AsNoTracking()
            .Where(a => only == null || a.Id == only)
            .Select(a => new
            {
                a.Id,
                Name = a.FirstName + " " + a.LastName,
                Latest = a.Readings.OrderByDescending(r => r.RecordedAtUtc).FirstOrDefault()
            })
            .ToListAsync(ct);

        var window = await db.VitalReadings.AsNoTracking()
            .Where(r => r.RecordedAtUtc >= since && (only == null || r.AstronautId == only))
            .OrderBy(r => r.RecordedAtUtc)
            .ToListAsync(ct);
        var byAstronaut = window.ToLookup(r => r.AstronautId);

        return astronauts
            .Select(a => Assess(a.Id, a.Name, a.Latest, byAstronaut[a.Id].ToList(), windowMinutes))
            .ToList();
    }

    private static HealthAssessmentResponse Assess(
        Guid id, string name, VitalReading? latest, IReadOnlyList<VitalReading> window, int windowMinutes)
    {
        var score = latest is null ? null : EarlyWarningScore.Calculate(latest);

        var series = TrendAnalyzer.SignificantChangePerHour.Keys.ToDictionary(
            metric => metric,
            metric => (IReadOnlyList<TimedValue>)window.Select(r => new TimedValue(r.RecordedAtUtc, r.ValueOf(metric))).ToList());

        var trends = TrendAnalyzer.Analyze(series, TimeSpan.FromMinutes(windowMinutes))
            .Select(t => new TrendResponse(
                t.Metric, t.Direction, t.ChangePerHour, t.CurrentValue, t.MinutesToLimit, t.FitQuality, t.Severity, t.Message))
            .ToList();

        return new HealthAssessmentResponse(
            id,
            name,
            latest?.RecordedAtUtc,
            score?.Score,
            score?.Risk,
            score?.Components.Select(c => new ScoreComponentResponse(c.Metric, c.Value, c.Points)).ToList() ?? [],
            windowMinutes,
            window.Count,
            trends);
    }
}
