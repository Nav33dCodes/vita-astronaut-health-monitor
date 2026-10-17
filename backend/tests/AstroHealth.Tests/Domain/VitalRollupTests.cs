using AstroHealth.Domain.Vitals;

namespace AstroHealth.Tests.Domain;

public class VitalRollupTests
{
    private static readonly Guid Astronaut = Guid.NewGuid();
    private static readonly DateTimeOffset Hour = new(2026, 10, 1, 8, 0, 0, TimeSpan.Zero);

    private static VitalReading Reading(int heartRate, decimal spo2, decimal radiation) =>
        new(Astronaut, Hour.AddMinutes(5), heartRate, 120, 80, spo2, 36.8m, 14, radiation);

    [Fact]
    public void Aggregates_readings_into_one_hour()
    {
        var rollup = VitalRollup.From(Astronaut, Hour, [Reading(60, 97m, 0.1m), Reading(80, 95m, 0.3m)]);

        Assert.Equal(2, rollup.Samples);
        Assert.Equal(70m, rollup.AvgHeartRateBpm);
        Assert.Equal(60, rollup.MinHeartRateBpm);
        Assert.Equal(80, rollup.MaxHeartRateBpm);
        Assert.Equal(95m, rollup.MinOxygenSaturationPct);
        Assert.Equal(0.4m, rollup.TotalRadiationDoseMsv);
    }

    [Fact]
    public void Absorb_combines_rollups_weighted_by_sample_count()
    {
        var first = VitalRollup.From(Astronaut, Hour, [Reading(60, 98m, 0.1m)]);
        var second = VitalRollup.From(Astronaut, Hour, [Reading(90, 92m, 0.2m), Reading(90, 96m, 0.2m)]);

        first.Absorb(second);

        Assert.Equal(3, first.Samples);
        Assert.Equal(80m, first.AvgHeartRateBpm);
        Assert.Equal(90, first.MaxHeartRateBpm);
        Assert.Equal(92m, first.MinOxygenSaturationPct);
        Assert.Equal(0.5m, first.TotalRadiationDoseMsv);
    }

    [Fact]
    public void Absorb_rejects_a_different_hour()
    {
        var a = VitalRollup.From(Astronaut, Hour, [Reading(60, 98m, 0.1m)]);
        var b = VitalRollup.From(Astronaut, Hour.AddHours(1), [Reading(60, 98m, 0.1m)]);

        Assert.Throws<InvalidOperationException>(() => a.Absorb(b));
    }
}
