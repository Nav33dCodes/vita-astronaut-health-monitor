using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Vitals;

namespace AstroHealth.Tests.Domain;

public class HealthEvaluatorTests
{
    private static VitalReading Reading(
        int heartRate = 72, int systolic = 118, int diastolic = 76, decimal spo2 = 98m,
        decimal temperature = 36.8m, int respiratory = 14, decimal radiation = 0.2m) =>
        new(Guid.NewGuid(), DateTimeOffset.UtcNow, heartRate, systolic, diastolic, spo2, temperature, respiratory, radiation);

    [Fact]
    public void Normal_vitals_produce_no_findings()
    {
        Assert.Empty(HealthEvaluator.Evaluate(Reading()));
    }

    [Theory]
    [InlineData(110, null)]
    [InlineData(111, AlertSeverity.Warning)]
    [InlineData(140, AlertSeverity.Warning)]
    [InlineData(141, AlertSeverity.Critical)]
    [InlineData(50, null)]
    [InlineData(49, AlertSeverity.Warning)]
    [InlineData(39, AlertSeverity.Critical)]
    public void Heart_rate_thresholds_are_inclusive(int heartRate, AlertSeverity? expected)
    {
        var finding = HealthEvaluator.Evaluate(Reading(heartRate: heartRate)).SingleOrDefault();

        Assert.Equal(expected, finding?.Severity);
    }

    [Fact]
    public void Low_oxygen_saturation_is_critical_with_descriptive_message()
    {
        var finding = Assert.Single(HealthEvaluator.Evaluate(Reading(spo2: 88.5m)));

        Assert.Equal(VitalMetric.OxygenSaturation, finding.Metric);
        Assert.Equal(AlertSeverity.Critical, finding.Severity);
        Assert.Equal("Oxygen saturation critically low: 88.5 %", finding.Message);
    }

    [Fact]
    public void Metrics_without_upper_bound_never_alert_high()
    {
        Assert.Empty(HealthEvaluator.Evaluate(Reading(spo2: 100m)));
    }

    [Fact]
    public void Multiple_abnormal_metrics_produce_one_finding_each()
    {
        var findings = HealthEvaluator.Evaluate(Reading(heartRate: 130, temperature: 39.5m, radiation: 2m));

        Assert.Equal(3, findings.Count);
        Assert.Contains(findings, f => f is { Metric: VitalMetric.BodyTemperature, Severity: AlertSeverity.Critical });
    }
}
