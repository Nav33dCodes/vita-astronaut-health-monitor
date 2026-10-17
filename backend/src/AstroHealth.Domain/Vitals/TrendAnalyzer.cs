namespace AstroHealth.Domain.Vitals;

public enum TrendDirection
{
    Rising,
    Falling
}

public enum TrendSeverity
{
    /// <summary>A sustained drift worth knowing about.</summary>
    Info,

    /// <summary>The drift is projected to cross a safe limit soon.</summary>
    Watch
}

public sealed record TimedValue(DateTimeOffset At, decimal Value);

public sealed record TrendFinding(
    VitalMetric Metric,
    TrendDirection Direction,
    decimal ChangePerHour,
    decimal CurrentValue,
    int? MinutesToLimit,
    decimal FitQuality,
    TrendSeverity Severity,
    string Message);

/// <summary>
/// Detects slow, sustained drifts that fixed thresholds miss — e.g. a heart rate creeping up for
/// an hour while still "in range". Uses a least-squares fit and only reports trends that are both
/// steep enough to matter and consistent enough (R²) not to be noise.
/// </summary>
public static class TrendAnalyzer
{
    private const int MinimumSamples = 10;
    // R² below this means the "trend" is mostly noise around a flat line.
    private const decimal MinimumFitQuality = 0.5m;
    private const int ProjectionHorizonMinutes = 120;

    /// <summary>Smallest drift per hour that is clinically interesting, per metric.</summary>
    public static readonly IReadOnlyDictionary<VitalMetric, decimal> SignificantChangePerHour = new Dictionary<VitalMetric, decimal>
    {
        [VitalMetric.HeartRate] = 10m,
        [VitalMetric.SystolicPressure] = 12m,
        [VitalMetric.OxygenSaturation] = 1.5m,
        [VitalMetric.BodyTemperature] = 0.4m,
        [VitalMetric.RespiratoryRate] = 3m
    };

    public static IReadOnlyList<TrendFinding> Analyze(
        IReadOnlyDictionary<VitalMetric, IReadOnlyList<TimedValue>> series,
        TimeSpan window)
    {
        var findings = new List<TrendFinding>();

        foreach (var (metric, minimumSlope) in SignificantChangePerHour)
        {
            if (!series.TryGetValue(metric, out var samples) || samples.Count < MinimumSamples)
            {
                continue;
            }

            // Require the samples to cover a meaningful part of the window.
            var span = samples[^1].At - samples[0].At;
            if (span < window * 0.4)
            {
                continue;
            }

            var (slopePerHour, intercept, r2) = Fit(samples);
            if (Math.Abs(slopePerHour) < minimumSlope || r2 < MinimumFitQuality)
            {
                continue;
            }

            var threshold = HealthEvaluator.Thresholds.First(t => t.Metric == metric);
            var hoursFromStart = (decimal)(samples[^1].At - samples[0].At).TotalHours;
            var current = Math.Round(intercept + slopePerHour * hoursFromStart, 2);
            var direction = slopePerHour > 0 ? TrendDirection.Rising : TrendDirection.Falling;

            // Only deterioration matters: a vital returning towards normal (recovery) is not a warning.
            if (!IsMovingAwayFromNormal(threshold, intercept, current, direction))
            {
                continue;
            }

            var limit = direction == TrendDirection.Rising ? threshold.WarningHigh : threshold.WarningLow;
            int? minutesToLimit = null;
            if (limit is { } bound && (direction == TrendDirection.Rising ? current < bound : current > bound))
            {
                var minutes = (int)Math.Ceiling((bound - current) / slopePerHour * 60);
                if (minutes <= ProjectionHorizonMinutes)
                {
                    minutesToLimit = minutes;
                }
            }

            var severity = minutesToLimit is not null ? TrendSeverity.Watch : TrendSeverity.Info;
            var verb = direction == TrendDirection.Rising ? "rising" : "falling";
            var rate = $"{Math.Abs(slopePerHour):0.#} {threshold.Unit}/h";
            var message = minutesToLimit is { } m
                ? $"{threshold.Label} {verb} {rate} — projected to cross {limit:0.##} {threshold.Unit} in ~{m} min"
                : $"{threshold.Label} {verb} steadily ({rate})";

            findings.Add(new TrendFinding(
                metric, direction, Math.Round(slopePerHour, 2), current, minutesToLimit, Math.Round(r2, 2), severity, message));
        }

        return findings
            .OrderByDescending(f => f.Severity)
            .ThenBy(f => f.MinutesToLimit ?? int.MaxValue)
            .ToList();
    }

    /// <summary>
    /// Two-sided ranges: the fitted line must end farther from the middle of the safe range than it
    /// started. One-sided ranges (e.g. SpO₂ has only a lower limit): only movement towards that limit counts.
    /// </summary>
    private static bool IsMovingAwayFromNormal(MetricThreshold t, decimal start, decimal end, TrendDirection direction) =>
        (t.WarningLow, t.WarningHigh) switch
        {
            ({ } low, { } high) => Math.Abs(end - (low + high) / 2) > Math.Abs(start - (low + high) / 2),
            ({ }, null) => direction == TrendDirection.Falling,
            (null, { }) => direction == TrendDirection.Rising,
            _ => false
        };

    /// <summary>Ordinary least squares on (hours since first sample, value).</summary>
    private static (decimal SlopePerHour, decimal Intercept, decimal R2) Fit(IReadOnlyList<TimedValue> samples)
    {
        var origin = samples[0].At;
        var xs = samples.Select(s => (s.At - origin).TotalHours).ToArray();
        var ys = samples.Select(s => (double)s.Value).ToArray();

        var meanX = xs.Average();
        var meanY = ys.Average();
        double sxy = 0, sxx = 0, syy = 0;
        for (var i = 0; i < xs.Length; i++)
        {
            sxy += (xs[i] - meanX) * (ys[i] - meanY);
            sxx += (xs[i] - meanX) * (xs[i] - meanX);
            syy += (ys[i] - meanY) * (ys[i] - meanY);
        }

        if (sxx == 0 || syy == 0)
        {
            return (0, (decimal)meanY, 0);
        }

        var slope = sxy / sxx;
        var r2 = sxy * sxy / (sxx * syy);
        return ((decimal)slope, (decimal)(meanY - slope * meanX), (decimal)r2);
    }
}
