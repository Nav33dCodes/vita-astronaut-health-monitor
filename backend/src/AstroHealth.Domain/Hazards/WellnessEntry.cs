using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Common;

namespace AstroHealth.Domain.Hazards;

/// <summary>
/// One day of behavioural-health data for a crew member: wrist actigraphy (sleep, activity and
/// light exposure, as in NASA's ARCHeR study on Artemis II) plus an optional self-reported
/// check-in (mood, stress, workload). Covers the "isolation and confinement" hazard.
/// </summary>
public sealed class WellnessEntry : Entity
{
    private WellnessEntry() { } // EF Core

    public WellnessEntry(
        Guid astronautId,
        DateOnly date,
        decimal sleepHours,
        int sleepEfficiencyPct,
        int activeMinutes,
        decimal lightExposureHours)
    {
        AstronautId = astronautId;
        Date = date;
        SleepHours = sleepHours;
        SleepEfficiencyPct = sleepEfficiencyPct;
        ActiveMinutes = activeMinutes;
        LightExposureHours = lightExposureHours;
    }

    public Guid AstronautId { get; private set; }

    /// <summary>The day the sleep period ended on (UTC).</summary>
    public DateOnly Date { get; private set; }

    public decimal SleepHours { get; private set; }
    public int SleepEfficiencyPct { get; private set; }
    public int ActiveMinutes { get; private set; }
    public decimal LightExposureHours { get; private set; }

    /// <summary>Self-reported scores, 1 (very poor / very low) to 5 (very good / very high).</summary>
    public int? Mood { get; private set; }
    public int? Stress { get; private set; }
    public int? Workload { get; private set; }
    public string? CheckInNote { get; private set; }
    public DateTimeOffset? CheckedInAtUtc { get; private set; }

    public void UpdateActigraphy(decimal sleepHours, int sleepEfficiencyPct, int activeMinutes, decimal lightExposureHours)
    {
        SleepHours = sleepHours;
        SleepEfficiencyPct = sleepEfficiencyPct;
        ActiveMinutes = activeMinutes;
        LightExposureHours = lightExposureHours;
    }

    public void CheckIn(int mood, int stress, int workload, string? note, DateTimeOffset at)
    {
        Mood = mood;
        Stress = stress;
        Workload = workload;
        CheckInNote = note;
        CheckedInAtUtc = at;
    }
}

public sealed record WellnessFinding(HealthStatus Status, string Message);

/// <summary>Turns recent wellness entries into a behavioural-health status.</summary>
public static class WellnessEvaluator
{
    /// <summary>Average sleep over the last three nights below this is a caution (hours).</summary>
    public const decimal SleepCautionHours = 6.0m;

    /// <summary>Average sleep over the last three nights below this is critical (hours).</summary>
    public const decimal SleepCriticalHours = 5.0m;

    /// <param name="recent">Entries ordered newest first.</param>
    public static IReadOnlyList<WellnessFinding> Evaluate(IReadOnlyList<WellnessEntry> recent)
    {
        var findings = new List<WellnessFinding>();
        if (recent.Count == 0)
        {
            return findings;
        }

        // Days with only a check-in (no actigraphy yet) have no sleep data.
        var lastNights = recent.Where(e => e.SleepHours > 0).Take(3).ToList();
        var avgSleep = lastNights.Count == 0 ? decimal.MaxValue : Math.Round(lastNights.Average(e => e.SleepHours), 1);
        if (avgSleep < SleepCriticalHours)
        {
            findings.Add(new WellnessFinding(HealthStatus.Critical, $"Severe sleep debt: {avgSleep} h average over the last {lastNights.Count} nights"));
        }
        else if (avgSleep < SleepCautionHours)
        {
            findings.Add(new WellnessFinding(HealthStatus.Caution, $"Sleep debt: {avgSleep} h average over the last {lastNights.Count} nights"));
        }

        var checkIns = recent.Where(e => e.Mood is not null).Take(3).ToList();
        if (checkIns.Count > 0)
        {
            var latest = checkIns[0];
            if (latest.Mood <= 1 || latest.Stress >= 5)
            {
                findings.Add(new WellnessFinding(HealthStatus.Critical, "Latest check-in reports very low mood or very high stress"));
            }
            else if (checkIns.Count >= 2 && checkIns.Average(e => e.Mood!.Value) <= 2.5)
            {
                findings.Add(new WellnessFinding(HealthStatus.Caution, "Low mood reported in recent check-ins"));
            }
            else if (checkIns.Count >= 2 && checkIns.Average(e => e.Stress!.Value) >= 4)
            {
                findings.Add(new WellnessFinding(HealthStatus.Caution, "High stress reported in recent check-ins"));
            }
        }

        return findings;
    }
}
