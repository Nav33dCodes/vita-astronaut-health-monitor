using AstroHealth.Domain.Common;

namespace AstroHealth.Domain.Vitals;

public enum VitalMetric
{
    HeartRate,
    SystolicPressure,
    DiastolicPressure,
    OxygenSaturation,
    BodyTemperature,
    RespiratoryRate,
    RadiationDose
}

/// <summary>A single snapshot of an astronaut's physiological vitals.</summary>
public sealed class VitalReading : Entity
{
    private VitalReading() { } // EF Core

    public VitalReading(
        Guid astronautId,
        DateTimeOffset recordedAtUtc,
        int heartRateBpm,
        int systolicMmHg,
        int diastolicMmHg,
        decimal oxygenSaturationPct,
        decimal bodyTemperatureC,
        int respiratoryRatePerMin,
        decimal radiationDoseMsv,
        string? notes = null)
    {
        AstronautId = astronautId;
        RecordedAtUtc = recordedAtUtc;
        HeartRateBpm = heartRateBpm;
        SystolicMmHg = systolicMmHg;
        DiastolicMmHg = diastolicMmHg;
        OxygenSaturationPct = oxygenSaturationPct;
        BodyTemperatureC = bodyTemperatureC;
        RespiratoryRatePerMin = respiratoryRatePerMin;
        RadiationDoseMsv = radiationDoseMsv;
        Notes = notes;
    }

    public Guid AstronautId { get; private set; }
    public DateTimeOffset RecordedAtUtc { get; private set; }
    public int HeartRateBpm { get; private set; }
    public int SystolicMmHg { get; private set; }
    public int DiastolicMmHg { get; private set; }
    public decimal OxygenSaturationPct { get; private set; }
    public decimal BodyTemperatureC { get; private set; }
    public int RespiratoryRatePerMin { get; private set; }

    /// <summary>Radiation dose absorbed since the previous reading, in millisieverts.</summary>
    public decimal RadiationDoseMsv { get; private set; }

    public string? Notes { get; private set; }

    public decimal ValueOf(VitalMetric metric) => metric switch
    {
        VitalMetric.HeartRate => HeartRateBpm,
        VitalMetric.SystolicPressure => SystolicMmHg,
        VitalMetric.DiastolicPressure => DiastolicMmHg,
        VitalMetric.OxygenSaturation => OxygenSaturationPct,
        VitalMetric.BodyTemperature => BodyTemperatureC,
        VitalMetric.RespiratoryRate => RespiratoryRatePerMin,
        VitalMetric.RadiationDose => RadiationDoseMsv,
        _ => throw new ArgumentOutOfRangeException(nameof(metric), metric, null)
    };
}
