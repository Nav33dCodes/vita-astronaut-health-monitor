namespace AstroHealth.Domain.Vitals;

public enum EarlyWarningRisk
{
    Low,

    /// <summary>Total is low, but one parameter scores 3 on its own — needs an urgent look.</summary>
    LowMedium,
    Medium,
    High
}

public sealed record ScoreComponent(VitalMetric Metric, decimal Value, int Points);

public sealed record EarlyWarningResult(int Score, EarlyWarningRisk Risk, IReadOnlyList<ScoreComponent> Components);

/// <summary>
/// One scoring band. A value falls in the first band (ordered low → high) whose upper bound it
/// does not exceed; the last band of a parameter is open-ended.
/// </summary>
public sealed record ScoreBand(string Range, int Points, decimal? UpperBound = null, bool UpperInclusive = true)
{
    public bool Contains(decimal value) =>
        UpperBound is not { } bound || value < bound || (UpperInclusive && value == bound);
}

public sealed record ScoredParameter(VitalMetric Metric, string Label, string Unit, IReadOnlyList<ScoreBand> Bands)
{
    public int PointsFor(decimal value) => Bands.First(b => b.Contains(value)).Points;
}

/// <summary>
/// Aggregate early-warning score adapted from the UK Royal College of Physicians' NEWS2.
/// Consciousness (3) and supplemental-oxygen (2) parameters are not captured by our sensors, so the
/// maximum here is 15 instead of 20. Not a clinical tool.
/// The band table below is the single source of truth: scoring and the published reference
/// table (API → Protocols page) both read it.
/// </summary>
public static class EarlyWarningScore
{
    public const int MediumRiskFrom = 5;
    public const int HighRiskFrom = 7;

    public static readonly IReadOnlyList<ScoredParameter> Parameters =
    [
        new(VitalMetric.RespiratoryRate, "Respiration", "/min",
        [
            new("≤ 8", 3, 8), new("9–11", 1, 11), new("12–20", 0, 20), new("21–24", 2, 24), new("≥ 25", 3)
        ]),
        new(VitalMetric.OxygenSaturation, "SpO₂", "%",
        [
            new("≤ 91", 3, 91), new("92–93", 2, 94, UpperInclusive: false), new("94–95", 1, 96, UpperInclusive: false),
            new("≥ 96", 0)
        ]),
        new(VitalMetric.SystolicPressure, "Systolic BP", "mmHg",
        [
            new("≤ 90", 3, 90), new("91–100", 2, 100), new("101–110", 1, 110), new("111–219", 0, 219), new("≥ 220", 3)
        ]),
        new(VitalMetric.HeartRate, "Heart rate", "bpm",
        [
            new("≤ 40", 3, 40), new("41–50", 1, 50), new("51–90", 0, 90), new("91–110", 1, 110), new("111–130", 2, 130),
            new("≥ 131", 3)
        ]),
        new(VitalMetric.BodyTemperature, "Temperature", "°C",
        [
            new("≤ 35.0", 3, 35.0m), new("35.1–36.0", 1, 36.0m), new("36.1–38.0", 0, 38.0m), new("38.1–39.0", 1, 39.0m),
            new("≥ 39.1", 2)
        ])
    ];

    public static readonly int MaxScore = Parameters.Sum(p => p.Bands.Max(b => b.Points));

    public static EarlyWarningResult Calculate(VitalReading reading)
    {
        var components = Parameters
            .Select(p => new ScoreComponent(p.Metric, reading.ValueOf(p.Metric), p.PointsFor(reading.ValueOf(p.Metric))))
            .ToList();

        var score = components.Sum(c => c.Points);
        var risk = score >= HighRiskFrom ? EarlyWarningRisk.High
            : score >= MediumRiskFrom ? EarlyWarningRisk.Medium
            : components.Any(c => c.Points == 3) ? EarlyWarningRisk.LowMedium
            : EarlyWarningRisk.Low;

        return new EarlyWarningResult(score, risk, components);
    }
}
