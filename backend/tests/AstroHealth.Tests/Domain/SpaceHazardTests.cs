using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Hazards;
using AstroHealth.Domain.Missions;
using AstroHealth.Domain.Vitals;

namespace AstroHealth.Tests.Domain;

public class SpaceHazardTests
{
    private static VitalReading Reading(decimal? doseRate) =>
        new(Guid.NewGuid(), DateTimeOffset.UtcNow, 72, 118, 76, 98m, 36.8m, 14, 0.0001m, radiationDoseRateMsvPerDay: doseRate);

    private static HabitatReading Cabin(
        decimal co2 = 2.0m, decimal o2 = 21m, decimal pressure = 101.3m, decimal temp = 22.5m, decimal humidity = 45m, decimal rate = 0.5m) =>
        new(Guid.NewGuid(), DateTimeOffset.UtcNow, co2, o2, pressure, temp, humidity, rate);

    // ---- Radiation -------------------------------------------------------------------------------

    [Theory]
    [InlineData(null, null)]
    [InlineData(0.5, null)]
    [InlineData(2.5, null)]
    [InlineData(2.6, AlertSeverity.Warning)]
    [InlineData(10.1, AlertSeverity.Critical)]
    public void Radiation_is_judged_on_the_dose_rate(double? rate, AlertSeverity? expected)
    {
        var finding = HealthEvaluator.Evaluate(Reading((decimal?)rate)).SingleOrDefault();

        Assert.Equal(expected, finding?.Severity);
        if (expected is not null)
        {
            Assert.Equal(VitalMetric.RadiationDose, finding!.Metric);
        }
    }

    [Fact]
    public void Deep_space_background_is_higher_than_low_earth_orbit()
    {
        Assert.True(SpaceEnvironment.BaselineDoseRateMsvPerDay(MissionDestination.Mars)
                    > SpaceEnvironment.BaselineDoseRateMsvPerDay(MissionDestination.LowEarthOrbit));
        Assert.Equal(600m, SpaceEnvironment.CareerDoseLimitMsv);
    }

    [Fact]
    public void Mission_dose_starts_from_the_estimate_once_then_accumulates()
    {
        var astronaut = new Astronaut("Ada", "Lovelace", "ESA", CrewRole.Pilot, new DateOnly(1985, 1, 1), Guid.NewGuid());
        var estimates = 0;

        astronaut.AccrueDose(0.5m, () => { estimates++; return 10m; });
        astronaut.AccrueDose(0.25m, () => { estimates++; return 999m; });

        Assert.Equal(1, estimates);
        Assert.Equal(10.75m, astronaut.MissionDoseMsv);
    }

    [Fact]
    public void Changing_mission_resets_the_dose_record()
    {
        var astronaut = new Astronaut("Ada", "Lovelace", "ESA", CrewRole.Pilot, new DateOnly(1985, 1, 1), Guid.NewGuid());
        astronaut.AccrueDose(1m, () => 0m);

        astronaut.Update("Ada", "Lovelace", "ESA", CrewRole.Pilot, new DateOnly(1985, 1, 1), Guid.NewGuid());

        Assert.Null(astronaut.MissionDoseMsv);
    }

    // ---- Distance from Earth ---------------------------------------------------------------------

    [Fact]
    public void Mars_requires_earth_independent_operations()
    {
        var (min, max) = SpaceEnvironment.OneWayLightTime(MissionDestination.Mars);

        Assert.True(min >= 60 && max > min);
        Assert.Equal(AutonomyLevel.EarthIndependent, SpaceEnvironment.Autonomy(MissionDestination.Mars));
        Assert.Equal(AutonomyLevel.EarthSupported, SpaceEnvironment.Autonomy(MissionDestination.Lunar));
    }

    [Fact]
    public void Every_alert_type_has_an_onboard_checklist()
    {
        foreach (var metric in Enum.GetValues<VitalMetric>())
        {
            Assert.NotNull(CrewActionPlaybook.For(metric.ToString()));
        }

        foreach (var metric in Enum.GetValues<HabitatMetric>())
        {
            Assert.NotNull(CrewActionPlaybook.For(metric.ToString()));
        }
    }

    // ---- Hostile / closed environment ------------------------------------------------------------

    [Fact]
    public void Nominal_cabin_has_no_findings()
    {
        var findings = HabitatEvaluator.Evaluate(Cabin());

        Assert.Empty(findings);
        Assert.Equal(HealthStatus.Nominal, HabitatEvaluator.StatusOf(findings));
    }

    [Fact]
    public void High_co2_is_a_caution_and_a_pressure_drop_is_critical()
    {
        var co2 = Assert.Single(HabitatEvaluator.Evaluate(Cabin(co2: 3.5m)));
        Assert.Equal(HabitatMetric.CarbonDioxide, co2.Metric);
        Assert.Equal(HealthStatus.Caution, co2.Status);

        var leak = Assert.Single(HabitatEvaluator.Evaluate(Cabin(pressure: 89m)));
        Assert.Equal(HealthStatus.Critical, leak.Status);
        Assert.Contains("low", leak.Message);
    }

    [Fact]
    public void Solar_particle_event_dose_rate_is_critical()
    {
        var findings = HabitatEvaluator.Evaluate(Cabin(rate: 25m));

        Assert.Equal(HealthStatus.Critical, HabitatEvaluator.StatusOf(findings));
    }

    // ---- Isolation and confinement ---------------------------------------------------------------

    private static WellnessEntry Night(int daysAgo, decimal sleep, int? mood = null, int? stress = null)
    {
        var entry = new WellnessEntry(Guid.Empty, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-daysAgo), sleep, 85, 90, 8m);
        if (mood is not null)
        {
            entry.CheckIn(mood.Value, stress ?? 3, 3, null, DateTimeOffset.UtcNow);
        }

        return entry;
    }

    [Theory]
    [InlineData(7.0, null)]
    [InlineData(5.5, HealthStatus.Caution)]
    [InlineData(4.5, HealthStatus.Critical)]
    public void Sleep_debt_over_three_nights(double hours, HealthStatus? expected)
    {
        var sleep = (decimal)hours;
        var findings = WellnessEvaluator.Evaluate([Night(0, sleep), Night(1, sleep), Night(2, sleep)]);

        Assert.Equal(expected, findings.SingleOrDefault()?.Status);
    }

    [Fact]
    public void A_check_in_without_actigraphy_does_not_count_as_zero_sleep()
    {
        var findings = WellnessEvaluator.Evaluate([Night(0, 0m, mood: 4), Night(1, 7.5m), Night(2, 7.5m)]);

        Assert.Empty(findings);
    }

    [Fact]
    public void Very_low_mood_is_critical()
    {
        var finding = Assert.Single(WellnessEvaluator.Evaluate([Night(0, 7.5m, mood: 1)]));

        Assert.Equal(HealthStatus.Critical, finding.Status);
    }
}
