using AstroHealth.Application.Abstractions;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Hazards;
using AstroHealth.Domain.Missions;
using AstroHealth.Domain.Vitals;
using Microsoft.EntityFrameworkCore;

namespace AstroHealth.Application.Hazards;

public interface IHazardService
{
    /// <summary>Every active mission and crew member assessed against the five HRP hazards.</summary>
    Task<HazardOverviewResponse> GetOverviewAsync(CancellationToken ct);

    IReadOnlyList<PlaybookEntryResponse> GetPlaybook();
}

internal sealed class HazardService(IAppDbContext db, IVitalService vitals, TimeProvider clock) : IHazardService
{
    /// <summary>Beyond about six months, bone and muscle loss from reduced gravity becomes a concern.</summary>
    private const int LongDurationDays = 180;

    public async Task<HazardOverviewResponse> GetOverviewAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var today = DateOnly.FromDateTime(now.UtcDateTime);

        var missions = await db.Missions.AsNoTracking()
            .Where(m => m.Status == MissionStatus.Active)
            .Select(m => new
            {
                m.Id, m.Name, m.Destination, m.LaunchDate,
                Crew = m.Crew.Select(a => new { a.Id, a.FirstName, a.LastName, a.Role, a.MissionDoseMsv }).ToList()
            })
            .ToListAsync(ct);

        var missionIds = missions.Select(m => m.Id).ToList();
        var crewIds = missions.SelectMany(m => m.Crew.Select(c => c.Id)).ToList();

        // Latest habitat reading per mission (one query, grouped in memory: a handful of rows per mission).
        var habitatSince = now.AddMinutes(-15);
        var habitats = (await db.HabitatReadings.AsNoTracking()
                .Where(h => missionIds.Contains(h.MissionId) && h.RecordedAtUtc >= habitatSince)
                .ToListAsync(ct))
            .GroupBy(h => h.MissionId)
            .ToDictionary(g => g.Key, g => HabitatReadingResponse.From(g.MaxBy(h => h.RecordedAtUtc)!));

        var latestVitals = await vitals.GetLatestReadingsAsync(ct);

        var wellnessSince = today.AddDays(-6);
        var wellness = (await db.WellnessEntries.AsNoTracking()
                .Where(e => crewIds.Contains(e.AstronautId) && e.Date >= wellnessSince)
                .ToListAsync(ct))
            .GroupBy(e => e.AstronautId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(e => e.Date).ToList());

        var openCritical = (await db.HealthAlerts.AsNoTracking()
                .Where(a => crewIds.Contains(a.AstronautId) && a.Status == AlertStatus.Open)
                .Select(a => new { a.AstronautId, a.Severity })
                .ToListAsync(ct))
            .Where(a => a.Severity == AlertSeverity.Critical)
            .GroupBy(a => a.AstronautId)
            .ToDictionary(g => g.Key, g => g.Count());

        var missionResponses = missions.Select(m =>
        {
            var launch = new DateTimeOffset(m.LaunchDate.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var elapsedDays = Math.Max(0, (int)(now - launch).TotalDays);
            var (minDelay, maxDelay) = SpaceEnvironment.OneWayLightTime(m.Destination);
            var autonomy = SpaceEnvironment.Autonomy(m.Destination);
            habitats.TryGetValue(m.Id, out var habitat);

            var crew = m.Crew
                .Select(c =>
                {
                    latestVitals.TryGetValue(c.Id, out var latest);
                    var entries = wellness.GetValueOrDefault(c.Id) ?? [];
                    var criticalAlerts = openCritical.GetValueOrDefault(c.Id);

                    var radiation = Budget(c.MissionDoseMsv, latest?.RadiationDoseRateMsvPerDay ?? habitat?.RadiationDoseRateMsvPerDay);
                    HazardStatusResponse[] hazards =
                    [
                        AssessRadiation(radiation, latest, habitat),
                        AssessIsolation(c.Id, entries),
                        AssessDistance(m.Destination, minDelay, maxDelay, autonomy, criticalAlerts),
                        AssessGravity(m.Destination, elapsedDays, latest),
                        AssessEnvironment(habitat, latest)
                    ];

                    return new CrewHazardsResponse(
                        c.Id, $"{c.FirstName} {c.LastName}", c.Role,
                        hazards.Max(h => h.Status), radiation, hazards);
                })
                .OrderByDescending(c => c.Overall)
                .ThenBy(c => c.Name)
                .ToList();

            return new MissionHazardsResponse(
                m.Id, m.Name, m.Destination, elapsedDays,
                new CommunicationDelayResponse(minDelay, maxDelay, autonomy),
                habitat, crew);
        }).ToList();

        var summary = Enum.GetValues<SpaceHazard>()
            .Select(hazard =>
            {
                var statuses = missionResponses
                    .SelectMany(m => m.Crew)
                    .Select(c => c.Hazards.First(h => h.Hazard == hazard).Status)
                    .ToList();
                return new HazardSummaryResponse(
                    hazard,
                    statuses.Count == 0 ? HealthStatus.Unknown : statuses.Max(),
                    statuses.Count(s => s == HealthStatus.Critical),
                    statuses.Count(s => s == HealthStatus.Caution),
                    statuses.Count(s => s == HealthStatus.Nominal),
                    statuses.Count(s => s == HealthStatus.Unknown));
            })
            .ToList();

        return new HazardOverviewResponse(now, summary, missionResponses);
    }

    public IReadOnlyList<PlaybookEntryResponse> GetPlaybook() =>
        CrewActionPlaybook.Entries
            .Select(e => new PlaybookEntryResponse(e.Key, e.Title, e.Hazard, e.HrpRisk, e.Steps))
            .ToList();

    // ---- Individual hazards ------------------------------------------------------------------

    private static RadiationBudgetResponse Budget(decimal? missionDose, decimal? rate)
    {
        var dose = Math.Round(missionDose ?? 0m, 2);
        var limit = SpaceEnvironment.CareerDoseLimitMsv;
        int? daysToLimit = rate is > 0 ? (int)Math.Max(0, Math.Floor((limit - dose) / rate.Value)) : null;
        return new RadiationBudgetResponse(dose, limit, Math.Round(dose / limit * 100, 1), rate, daysToLimit);
    }

    private static HazardStatusResponse AssessRadiation(RadiationBudgetResponse budget, VitalReadingResponse? latest, HabitatReadingResponse? habitat)
    {
        var rate = budget.CurrentRateMsvPerDay;
        var threshold = HealthEvaluator.Thresholds.First(t => t.Metric == VitalMetric.RadiationDose);
        var rateStatus = rate is null ? HealthStatus.Unknown
            : rate > threshold.CriticalHigh ? HealthStatus.Critical
            : rate > threshold.WarningHigh ? HealthStatus.Caution
            : HealthStatus.Nominal;

        var budgetStatus = budget.PercentOfLimit >= 100 ? HealthStatus.Critical
            : budget.PercentOfLimit >= 80 ? HealthStatus.Caution
            : HealthStatus.Nominal;

        var status = rate is null && latest is null && habitat is null ? HealthStatus.Unknown : Worst(rateStatus, budgetStatus);
        var detail = rateStatus == HealthStatus.Critical
            ? "Solar particle event conditions: shelter the crew"
            : rate is null ? null : $"Dose rate {rate:0.00} mSv/day";

        return new HazardStatusResponse(
            SpaceHazard.SpaceRadiation, status,
            $"{budget.MissionDoseMsv:0.0} mSv this mission · {budget.PercentOfLimit:0.#}% of career limit",
            detail);
    }

    private static HazardStatusResponse AssessIsolation(Guid astronautId, IReadOnlyList<WellnessEntry> entries)
    {
        var wellness = WellnessService.ToResponse(astronautId, 7, entries);
        if (wellness.Status == HealthStatus.Unknown)
        {
            return new HazardStatusResponse(SpaceHazard.IsolationAndConfinement, HealthStatus.Unknown, "No sleep or check-in data yet", null);
        }

        var latestCheckIn = entries.FirstOrDefault(e => e.Mood is not null);
        var headline = wellness.AverageSleepHours is { } sleep ? $"Sleep {sleep:0.0} h avg" : "No sleep data";
        if (latestCheckIn is not null)
        {
            headline += $" · mood {latestCheckIn.Mood}/5 · stress {latestCheckIn.Stress}/5";
        }

        return new HazardStatusResponse(
            SpaceHazard.IsolationAndConfinement, wellness.Status, headline,
            wellness.Findings.Count > 0 ? wellness.Findings[0].Message : null);
    }

    private static HazardStatusResponse AssessDistance(
        MissionDestination destination, double minDelay, double maxDelay, AutonomyLevel autonomy, int openCriticalAlerts)
    {
        var delay = maxDelay < 1 ? "real-time link"
            : maxDelay < 60 ? $"{maxDelay:0.#} s signal delay"
            : minDelay == maxDelay ? $"{maxDelay / 60:0} min signal delay"
            : $"{minDelay / 60:0}–{maxDelay / 60:0} min signal delay";

        // Far from Earth, an open critical alert must be handled onboard before the ground can respond.
        var status = autonomy == AutonomyLevel.EarthIndependent && openCriticalAlerts > 0 ? HealthStatus.Caution : HealthStatus.Nominal;
        var mode = autonomy == AutonomyLevel.EarthIndependent ? "Earth-independent operations" : "Earth-supported";

        return new HazardStatusResponse(
            SpaceHazard.DistanceFromEarth, status, $"{delay} · {mode}",
            status == HealthStatus.Caution
                ? $"{openCriticalAlerts} critical alert(s) need onboard response"
                : destination == MissionDestination.LowEarthOrbit ? "Return to Earth possible within hours" : null);
    }

    private static HazardStatusResponse AssessGravity(MissionDestination destination, int elapsedDays, VitalReadingResponse? latest)
    {
        var cardio = CardioStatus(latest);
        var duration = elapsedDays >= LongDurationDays ? HealthStatus.Caution : HealthStatus.Nominal;
        var gravity = destination == MissionDestination.Lunar ? "partial gravity" : "microgravity";

        var status = latest is null ? Worst(HealthStatus.Unknown, duration) : Worst(cardio, duration);
        var detail = cardio is HealthStatus.Caution or HealthStatus.Critical
            ? "Heart rate or blood pressure outside safe range"
            : duration == HealthStatus.Caution
                ? "Long-duration exposure: monitor bone and muscle loss"
                : "Cardiovascular readings within range";

        return new HazardStatusResponse(SpaceHazard.GravityFields, status, $"Day {elapsedDays} in {gravity}", detail);
    }

    private static HazardStatusResponse AssessEnvironment(HabitatReadingResponse? habitat, VitalReadingResponse? latest)
    {
        var spo2 = latest is null ? HealthStatus.Unknown : Classify(VitalMetric.OxygenSaturation, latest.OxygenSaturationPct);
        if (habitat is null)
        {
            return new HazardStatusResponse(
                SpaceHazard.HostileClosedEnvironments, spo2 == HealthStatus.Nominal ? HealthStatus.Unknown : spo2,
                "No cabin telemetry", null);
        }

        var status = Worst(habitat.Status, spo2 == HealthStatus.Unknown ? HealthStatus.Nominal : spo2);
        var headline = $"CO₂ {habitat.CarbonDioxideMmHg:0.0} mmHg · O₂ {habitat.OxygenPct:0.0}% · {habitat.CabinPressureKpa:0.0} kPa";
        var detail = habitat.Findings.Count > 0
            ? habitat.Findings.MaxBy(f => f.Status)!.Message
            : spo2 is HealthStatus.Caution or HealthStatus.Critical ? "Low blood oxygen despite nominal cabin" : null;

        return new HazardStatusResponse(SpaceHazard.HostileClosedEnvironments, status, headline, detail);
    }

    // ---- Helpers -------------------------------------------------------------------------------

    private static HealthStatus CardioStatus(VitalReadingResponse? r) =>
        r is null
            ? HealthStatus.Unknown
            : Worst(
                Classify(VitalMetric.HeartRate, r.HeartRateBpm),
                Worst(Classify(VitalMetric.SystolicPressure, r.SystolicMmHg), Classify(VitalMetric.DiastolicPressure, r.DiastolicMmHg)));

    private static HealthStatus Classify(VitalMetric metric, decimal value)
    {
        var t = HealthEvaluator.Thresholds.First(x => x.Metric == metric);
        if (value < t.CriticalLow || value > t.CriticalHigh)
        {
            return HealthStatus.Critical;
        }

        return value < t.WarningLow || value > t.WarningHigh ? HealthStatus.Caution : HealthStatus.Nominal;
    }

    private static HealthStatus Worst(HealthStatus a, HealthStatus b) => a >= b ? a : b;
}
