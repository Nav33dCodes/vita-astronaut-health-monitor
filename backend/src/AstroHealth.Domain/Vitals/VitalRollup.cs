namespace AstroHealth.Domain.Vitals;

/// <summary>
/// One hour of an astronaut's telemetry, aggregated. Raw readings older than the retention
/// window are folded into rollups, so long-range history stays cheap to store and query.
/// </summary>
public sealed class VitalRollup
{
    private VitalRollup() { } // EF Core

    public Guid AstronautId { get; private set; }
    public DateTimeOffset BucketStartUtc { get; private set; }
    public int Samples { get; private set; }

    public decimal AvgHeartRateBpm { get; private set; }
    public int MinHeartRateBpm { get; private set; }
    public int MaxHeartRateBpm { get; private set; }
    public decimal AvgSystolicMmHg { get; private set; }
    public decimal AvgDiastolicMmHg { get; private set; }
    public decimal AvgOxygenSaturationPct { get; private set; }
    public decimal MinOxygenSaturationPct { get; private set; }
    public decimal AvgBodyTemperatureC { get; private set; }
    public decimal MaxBodyTemperatureC { get; private set; }
    public decimal AvgRespiratoryRatePerMin { get; private set; }
    public decimal AvgRadiationDoseMsv { get; private set; }
    public decimal TotalRadiationDoseMsv { get; private set; }

    public static VitalRollup From(Guid astronautId, DateTimeOffset bucketStartUtc, IReadOnlyCollection<VitalReading> readings)
    {
        if (readings.Count == 0)
        {
            throw new ArgumentException("A rollup needs at least one reading.", nameof(readings));
        }

        return new VitalRollup
        {
            AstronautId = astronautId,
            BucketStartUtc = bucketStartUtc,
            Samples = readings.Count,
            AvgHeartRateBpm = Round(readings.Average(r => (decimal)r.HeartRateBpm)),
            MinHeartRateBpm = readings.Min(r => r.HeartRateBpm),
            MaxHeartRateBpm = readings.Max(r => r.HeartRateBpm),
            AvgSystolicMmHg = Round(readings.Average(r => (decimal)r.SystolicMmHg)),
            AvgDiastolicMmHg = Round(readings.Average(r => (decimal)r.DiastolicMmHg)),
            AvgOxygenSaturationPct = Round(readings.Average(r => r.OxygenSaturationPct)),
            MinOxygenSaturationPct = readings.Min(r => r.OxygenSaturationPct),
            AvgBodyTemperatureC = Round(readings.Average(r => r.BodyTemperatureC)),
            MaxBodyTemperatureC = readings.Max(r => r.BodyTemperatureC),
            AvgRespiratoryRatePerMin = Round(readings.Average(r => (decimal)r.RespiratoryRatePerMin)),
            AvgRadiationDoseMsv = Math.Round(readings.Average(r => r.RadiationDoseMsv), 4),
            TotalRadiationDoseMsv = readings.Sum(r => r.RadiationDoseMsv)
        };
    }

    /// <summary>Folds another rollup for the same hour into this one (sample-weighted).</summary>
    public void Absorb(VitalRollup other)
    {
        if (other.AstronautId != AstronautId || other.BucketStartUtc != BucketStartUtc)
        {
            throw new InvalidOperationException("Can only merge rollups for the same astronaut and hour.");
        }

        var total = Samples + other.Samples;
        decimal Weighted(decimal mine, decimal theirs) => Round((mine * Samples + theirs * other.Samples) / total);

        AvgHeartRateBpm = Weighted(AvgHeartRateBpm, other.AvgHeartRateBpm);
        AvgSystolicMmHg = Weighted(AvgSystolicMmHg, other.AvgSystolicMmHg);
        AvgDiastolicMmHg = Weighted(AvgDiastolicMmHg, other.AvgDiastolicMmHg);
        AvgOxygenSaturationPct = Weighted(AvgOxygenSaturationPct, other.AvgOxygenSaturationPct);
        AvgBodyTemperatureC = Weighted(AvgBodyTemperatureC, other.AvgBodyTemperatureC);
        AvgRespiratoryRatePerMin = Weighted(AvgRespiratoryRatePerMin, other.AvgRespiratoryRatePerMin);
        AvgRadiationDoseMsv = Math.Round((AvgRadiationDoseMsv * Samples + other.AvgRadiationDoseMsv * other.Samples) / total, 4);
        MinHeartRateBpm = Math.Min(MinHeartRateBpm, other.MinHeartRateBpm);
        MaxHeartRateBpm = Math.Max(MaxHeartRateBpm, other.MaxHeartRateBpm);
        MinOxygenSaturationPct = Math.Min(MinOxygenSaturationPct, other.MinOxygenSaturationPct);
        MaxBodyTemperatureC = Math.Max(MaxBodyTemperatureC, other.MaxBodyTemperatureC);
        TotalRadiationDoseMsv += other.TotalRadiationDoseMsv;
        Samples = total;
    }

    private static decimal Round(decimal value) => Math.Round(value, 2);
}
