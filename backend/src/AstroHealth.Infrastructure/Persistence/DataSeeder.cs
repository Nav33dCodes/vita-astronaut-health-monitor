using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Missions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AstroHealth.Infrastructure.Persistence;

/// <summary>Populates an empty database with realistic demo crews and three days of vitals.</summary>
internal sealed class DataSeeder(AppDbContext db, IVitalService vitals, TimeProvider clock, ILogger<DataSeeder> logger)
{
    private const int DaysOfHistory = 3;
    private const int HoursBetweenReadings = 4;

    public async Task SeedAsync(CancellationToken ct)
    {
        if (await db.Missions.AnyAsync(ct))
        {
            return;
        }

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);

        var artemis = new Mission("Artemis III", MissionDestination.Lunar, today.AddDays(-12),
            "First crewed lunar landing of the Artemis program near the lunar south pole.");
        var expedition = new Mission("Expedition 74", MissionDestination.LowEarthOrbit, today.AddDays(-95),
            "Long-duration science expedition aboard the International Space Station.");
        var ares = new Mission("Ares Pathfinder", MissionDestination.Mars, today.AddYears(2),
            "Crewed Mars transit and surface operations demonstration.");
        artemis.ChangeStatus(MissionStatus.Active);
        expedition.ChangeStatus(MissionStatus.Active);

        db.Missions.AddRange(artemis, expedition, ares);

        Astronaut[] crew =
        [
            new("Maya", "Okafor", "NASA", CrewRole.Commander, new DateOnly(1982, 3, 14), artemis.Id),
            new("Lucas", "Brandt", "ESA", CrewRole.Pilot, new DateOnly(1986, 11, 2), artemis.Id),
            new("Aiko", "Tanaka", "JAXA", CrewRole.MissionSpecialist, new DateOnly(1989, 6, 21), artemis.Id),
            new("Daniel", "Reyes", "NASA", CrewRole.MedicalOfficer, new DateOnly(1984, 1, 30), artemis.Id),
            new("Sara", "Haddad", "NASA", CrewRole.Commander, new DateOnly(1979, 9, 9), expedition.Id),
            new("Ivan", "Petrov", "Roscosmos", CrewRole.FlightEngineer, new DateOnly(1985, 4, 17), expedition.Id),
            new("Priya", "Nair", "CSA", CrewRole.PayloadSpecialist, new DateOnly(1991, 12, 5), expedition.Id),
            new("Omar", "Siddiqui", "NASA", CrewRole.FlightEngineer, new DateOnly(1990, 7, 12), ares.Id)
        ];

        db.Astronauts.AddRange(crew);
        await db.SaveChangesAsync(ct);

        var random = new Random(42);
        var now = clock.GetUtcNow();
        var onActiveMission = crew.Where(a => a.MissionId != ares.Id).ToList();

        foreach (var astronaut in onActiveMission)
        {
            for (var hoursAgo = DaysOfHistory * 24; hoursAgo >= 0; hoursAgo -= HoursBetweenReadings)
            {
                var request = NormalReading(random, now.AddHours(-hoursAgo));

                // Inject a couple of medically interesting scenarios into the latest readings.
                if (hoursAgo <= 8 && astronaut.LastName == "Brandt")
                {
                    request = request with { HeartRateBpm = 128, SystolicMmHg = 152, Notes = "Post-EVA fatigue reported." };
                }
                else if (hoursAgo == 0 && astronaut.LastName == "Petrov")
                {
                    request = request with { OxygenSaturationPct = 88.5m, RespiratoryRatePerMin = 26, Notes = "Possible CO2 scrubber issue in module." };
                }
                else if (hoursAgo == 4 && astronaut.LastName == "Tanaka")
                {
                    request = request with { RadiationDoseMsv = 1.6m, Notes = "Solar particle event during lunar surface ops." };
                }

                await vitals.RecordAsync(astronaut.Id, request, ct);
            }
        }

        logger.LogInformation("Seeded {Missions} missions and {Crew} astronauts with vitals history", 3, crew.Length);
    }

    private static RecordVitalsRequest NormalReading(Random random, DateTimeOffset at) => new(
        HeartRateBpm: random.Next(58, 92),
        SystolicMmHg: random.Next(105, 130),
        DiastolicMmHg: random.Next(65, 84),
        OxygenSaturationPct: Math.Round(96m + (decimal)random.NextDouble() * 3.5m, 1),
        BodyTemperatureC: Math.Round(36.2m + (decimal)random.NextDouble() * 1.0m, 1),
        RespiratoryRatePerMin: random.Next(12, 19),
        RadiationDoseMsv: Math.Round(0.05m + (decimal)random.NextDouble() * 0.4m, 3),
        RecordedAtUtc: at);
}
