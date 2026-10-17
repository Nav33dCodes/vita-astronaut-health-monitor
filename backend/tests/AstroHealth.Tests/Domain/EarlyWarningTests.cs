using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Vitals;
using AstroHealth.Application.Alerts;

namespace AstroHealth.Tests.Domain;

public class EarlyWarningScoreTests
{
    private static VitalReading Reading(int hr = 72, int sys = 120, decimal spo2 = 98, decimal temp = 36.8m, int rr = 14) =>
        new(Guid.NewGuid(), DateTimeOffset.UtcNow, hr, sys, 76, spo2, temp, rr, 0.001m);

    [Fact]
    public void Healthy_vitals_score_zero_and_low_risk()
    {
        var result = EarlyWarningScore.Calculate(Reading());

        Assert.Equal(0, result.Score);
        Assert.Equal(EarlyWarningRisk.Low, result.Risk);
        Assert.Equal(5, result.Components.Count);
    }

    [Fact]
    public void Max_score_is_derived_from_the_band_table()
    {
        // NEWS2 max is 20; we lack consciousness (3) and supplemental O2 (2).
        Assert.Equal(15, EarlyWarningScore.MaxScore);
    }

    [Theory]
    [InlineData(91.0, 3)]
    [InlineData(93.5, 2)]
    [InlineData(95.9, 1)]
    [InlineData(96.0, 0)]
    public void Fractional_oxygen_saturation_falls_into_the_right_band(double spo2, int expectedPoints)
    {
        var result = EarlyWarningScore.Calculate(Reading(spo2: (decimal)spo2));

        Assert.Equal(expectedPoints, result.Components.Single(c => c.Metric == VitalMetric.OxygenSaturation).Points);
    }

    [Fact]
    public void A_single_extreme_parameter_is_low_medium_risk()
    {
        var result = EarlyWarningScore.Calculate(Reading(spo2: 90));

        Assert.Equal(3, result.Score);
        Assert.Equal(EarlyWarningRisk.LowMedium, result.Risk);
    }

    [Theory]
    [InlineData(105, 100, 24, 5, EarlyWarningRisk.Medium)] // HR 1 + Sys 2 + RR 2
    [InlineData(135, 88, 26, 9, EarlyWarningRisk.High)]    // HR 3 + Sys 3 + RR 3
    public void Scores_add_up_into_risk_bands(int hr, int sys, int rr, int expectedScore, EarlyWarningRisk expectedRisk)
    {
        var result = EarlyWarningScore.Calculate(Reading(hr: hr, sys: sys, rr: rr));

        Assert.Equal(expectedScore, result.Score);
        Assert.Equal(expectedRisk, result.Risk);
    }
}

public class TrendAnalyzerTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 17, 8, 0, 0, TimeSpan.Zero);

    private static IReadOnlyDictionary<VitalMetric, IReadOnlyList<TimedValue>> Series(VitalMetric metric, Func<int, decimal> valueAtMinute) =>
        new Dictionary<VitalMetric, IReadOnlyList<TimedValue>>
        {
            [metric] = Enumerable.Range(0, 60).Select(m => new TimedValue(Start.AddMinutes(m), valueAtMinute(m))).ToList()
        };

    [Fact]
    public void Steady_heart_rate_rise_is_detected_with_time_to_limit()
    {
        // 70 → ~99 bpm over an hour (~30 bpm/h); warning limit is 110.
        var finding = Assert.Single(TrendAnalyzer.Analyze(Series(VitalMetric.HeartRate, m => 70 + m * 0.5m), TimeSpan.FromHours(1)));

        Assert.Equal(TrendDirection.Rising, finding.Direction);
        Assert.Equal(TrendSeverity.Watch, finding.Severity);
        Assert.InRange(finding.ChangePerHour, 29m, 31m);
        Assert.InRange(finding.MinutesToLimit!.Value, 20, 26);
    }

    [Fact]
    public void Falling_oxygen_saturation_is_detected()
    {
        var finding = Assert.Single(TrendAnalyzer.Analyze(Series(VitalMetric.OxygenSaturation, m => 98 - m * 0.05m), TimeSpan.FromHours(1)));

        Assert.Equal(TrendDirection.Falling, finding.Direction);
    }

    [Fact]
    public void Recovery_towards_normal_is_not_reported()
    {
        // Heart rate settling from 125 back to ~95 after an episode: improving, not deteriorating.
        var findings = TrendAnalyzer.Analyze(Series(VitalMetric.HeartRate, m => 125 - m * 0.5m), TimeSpan.FromHours(1));

        Assert.Empty(findings);
    }

    [Fact]
    public void Rising_oxygen_saturation_is_never_a_warning()
    {
        var findings = TrendAnalyzer.Analyze(Series(VitalMetric.OxygenSaturation, m => 93 + m * 0.05m), TimeSpan.FromHours(1));

        Assert.Empty(findings);
    }

    [Fact]
    public void Noise_without_a_trend_is_ignored()
    {
        var random = new Random(7);
        var findings = TrendAnalyzer.Analyze(Series(VitalMetric.HeartRate, _ => 72 + random.Next(-6, 7)), TimeSpan.FromHours(1));

        Assert.Empty(findings);
    }
}

public class EscalationPolicyTests
{
    private readonly EscalationPolicy _policy = new() { CriticalAckMinutes = 2, WarningAckMinutes = 15, RepeatMinutes = 5, MaxLevel = 3 };

    [Theory]
    [InlineData(AlertSeverity.Critical, 1, 0)]
    [InlineData(AlertSeverity.Critical, 2, 1)]
    [InlineData(AlertSeverity.Critical, 7, 2)]
    [InlineData(AlertSeverity.Critical, 60, 3)]
    [InlineData(AlertSeverity.Warning, 10, 0)]
    [InlineData(AlertSeverity.Warning, 16, 1)]
    public void Level_grows_with_time_unacknowledged(AlertSeverity severity, int minutes, int expectedLevel)
    {
        Assert.Equal(expectedLevel, _policy.LevelFor(severity, TimeSpan.FromMinutes(minutes)));
    }

    [Fact]
    public void Acknowledged_alerts_never_escalate()
    {
        var reading = new VitalReading(Guid.NewGuid(), DateTimeOffset.UtcNow, 150, 120, 76, 98, 36.8m, 14, 0.001m);
        var alert = HealthAlert.Raise(reading, HealthEvaluator.Evaluate(reading).Single());
        alert.Acknowledge(DateTimeOffset.UtcNow);

        Assert.False(alert.EscalateTo(1, DateTimeOffset.UtcNow));
        Assert.Equal(0, alert.EscalationLevel);
    }
}
