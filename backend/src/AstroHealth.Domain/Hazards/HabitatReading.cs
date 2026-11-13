using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Common;

namespace AstroHealth.Domain.Hazards;

public enum HabitatMetric
{
    CarbonDioxide,
    Oxygen,
    CabinPressure,
    CabinTemperature,
    Humidity,
    RadiationDoseRate
}

/// <summary>
/// One snapshot of a spacecraft's cabin environment (the "hostile/closed environment" hazard)
/// plus the area radiation monitor, shared by every crew member aboard.
/// </summary>
public sealed class HabitatReading : Entity
{
    private HabitatReading() { } // EF Core

    public HabitatReading(
        Guid missionId,
        DateTimeOffset recordedAtUtc,
        decimal carbonDioxideMmHg,
        decimal oxygenPct,
        decimal cabinPressureKpa,
        decimal cabinTemperatureC,
        decimal humidityPct,
        decimal radiationDoseRateMsvPerDay)
    {
        MissionId = missionId;
        RecordedAtUtc = recordedAtUtc;
        CarbonDioxideMmHg = carbonDioxideMmHg;
        OxygenPct = oxygenPct;
        CabinPressureKpa = cabinPressureKpa;
        CabinTemperatureC = cabinTemperatureC;
        HumidityPct = humidityPct;
        RadiationDoseRateMsvPerDay = radiationDoseRateMsvPerDay;
    }

    public Guid MissionId { get; private set; }
    public DateTimeOffset RecordedAtUtc { get; private set; }

    /// <summary>Partial pressure of CO2 in the cabin, mmHg.</summary>
    public decimal CarbonDioxideMmHg { get; private set; }

    /// <summary>Oxygen fraction of the cabin atmosphere, percent.</summary>
    public decimal OxygenPct { get; private set; }

    public decimal CabinPressureKpa { get; private set; }
    public decimal CabinTemperatureC { get; private set; }
    public decimal HumidityPct { get; private set; }

    /// <summary>Area radiation monitor dose rate inside the habitat, mSv/day.</summary>
    public decimal RadiationDoseRateMsvPerDay { get; private set; }

    public decimal ValueOf(HabitatMetric metric) => metric switch
    {
        HabitatMetric.CarbonDioxide => CarbonDioxideMmHg,
        HabitatMetric.Oxygen => OxygenPct,
        HabitatMetric.CabinPressure => CabinPressureKpa,
        HabitatMetric.CabinTemperature => CabinTemperatureC,
        HabitatMetric.Humidity => HumidityPct,
        HabitatMetric.RadiationDoseRate => RadiationDoseRateMsvPerDay,
        _ => throw new ArgumentOutOfRangeException(nameof(metric), metric, null)
    };
}

public sealed record HabitatThreshold(
    HabitatMetric Metric,
    string Label,
    string Unit,
    decimal? WarningLow,
    decimal? WarningHigh,
    decimal? CriticalLow,
    decimal? CriticalHigh);

public sealed record HabitatFinding(HabitatMetric Metric, HealthStatus Status, decimal Value, string Message);

/// <summary>Rule engine for the cabin environment.</summary>
public static class HabitatEvaluator
{
    /// <summary>
    /// Demonstration limits. CO2 follows the NASA-STD-3001 direction of keeping ppCO2 at or below
    /// about 3 mmHg; the radiation critical limit marks solar-particle-event conditions where the
    /// crew should move to the storm shelter. Approximate values, not flight rules.
    /// </summary>
    public static readonly IReadOnlyList<HabitatThreshold> Thresholds =
    [
        new(HabitatMetric.CarbonDioxide, "Carbon dioxide (ppCO₂)", "mmHg", null, 3.0m, null, 6.0m),
        new(HabitatMetric.Oxygen, "Oxygen", "%", 19.5m, 23.5m, 17.0m, 25.0m),
        new(HabitatMetric.CabinPressure, "Cabin pressure", "kPa", 97.0m, 103.0m, 90.0m, 106.0m),
        new(HabitatMetric.CabinTemperature, "Cabin temperature", "°C", 18.0m, 27.0m, 15.0m, 30.0m),
        new(HabitatMetric.Humidity, "Relative humidity", "%", 25.0m, 70.0m, 15.0m, 80.0m),
        new(HabitatMetric.RadiationDoseRate, "Radiation dose rate", "mSv/day", null, 2.5m, null, 10.0m)
    ];

    public static IReadOnlyList<HabitatFinding> Evaluate(HabitatReading reading)
    {
        var findings = new List<HabitatFinding>();
        foreach (var t in Thresholds)
        {
            var value = reading.ValueOf(t.Metric);
            var direction = value < (t.WarningLow ?? decimal.MinValue) ? "low" : "high";

            if (value < t.CriticalLow || value > t.CriticalHigh)
            {
                findings.Add(new HabitatFinding(t.Metric, HealthStatus.Critical, value, $"{t.Label} critically {direction}: {value:0.##} {t.Unit}"));
            }
            else if (value < t.WarningLow || value > t.WarningHigh)
            {
                findings.Add(new HabitatFinding(t.Metric, HealthStatus.Caution, value, $"{t.Label} {direction}: {value:0.##} {t.Unit}"));
            }
        }

        return findings;
    }

    public static HealthStatus StatusOf(IReadOnlyList<HabitatFinding> findings) =>
        findings.Count == 0 ? HealthStatus.Nominal : findings.Max(f => f.Status);
}
