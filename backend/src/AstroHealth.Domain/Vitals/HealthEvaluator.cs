using AstroHealth.Domain.Alerts;

namespace AstroHealth.Domain.Vitals;

/// <summary>
/// Safe ranges for one metric. A value outside the warning range raises a warning;
/// a value outside the critical range raises a critical alert. Null means "no bound".
/// </summary>
public sealed record MetricThreshold(
    VitalMetric Metric,
    string Label,
    string Unit,
    decimal? WarningLow,
    decimal? WarningHigh,
    decimal? CriticalLow,
    decimal? CriticalHigh);

public sealed record HealthFinding(VitalMetric Metric, AlertSeverity Severity, decimal ObservedValue, string Message);

/// <summary>Pure rule engine that turns a vitals snapshot into health findings.</summary>
public static class HealthEvaluator
{
    // Reference ranges loosely based on NASA crew health standards (NASA-STD-3001).
    public static readonly IReadOnlyList<MetricThreshold> Thresholds =
    [
        new(VitalMetric.HeartRate, "Heart rate", "bpm", 50, 110, 40, 140),
        new(VitalMetric.SystolicPressure, "Systolic blood pressure", "mmHg", 90, 140, 80, 180),
        new(VitalMetric.DiastolicPressure, "Diastolic blood pressure", "mmHg", 60, 90, 50, 120),
        new(VitalMetric.OxygenSaturation, "Oxygen saturation", "%", 94, null, 90, null),
        new(VitalMetric.BodyTemperature, "Body temperature", "C", 35.5m, 37.8m, 35.0m, 39.0m),
        new(VitalMetric.RespiratoryRate, "Respiratory rate", "breaths/min", 10, 22, 8, 30),
        new(VitalMetric.RadiationDose, "Radiation dose", "mSv", null, 1.0m, null, 5.0m)
    ];

    public static IReadOnlyList<HealthFinding> Evaluate(VitalReading reading)
    {
        var findings = new List<HealthFinding>();

        foreach (var threshold in Thresholds)
        {
            var finding = Check(threshold, reading.ValueOf(threshold.Metric));
            if (finding is not null)
            {
                findings.Add(finding);
            }
        }

        return findings;
    }

    private static HealthFinding? Check(MetricThreshold t, decimal value)
    {
        var direction = value < t.WarningLow ? "low" : "high";

        if (value < t.CriticalLow || value > t.CriticalHigh)
        {
            return new HealthFinding(t.Metric, AlertSeverity.Critical, value,
                $"{t.Label} critically {direction}: {value:0.##} {t.Unit}");
        }

        if (value < t.WarningLow || value > t.WarningHigh)
        {
            return new HealthFinding(t.Metric, AlertSeverity.Warning, value,
                $"{t.Label} {direction}: {value:0.##} {t.Unit}");
        }

        return null;
    }
}
