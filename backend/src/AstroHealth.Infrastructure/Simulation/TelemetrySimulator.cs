using AstroHealth.Application.Abstractions;
using AstroHealth.Application.Hazards;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Hazards;
using AstroHealth.Domain.Missions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AstroHealth.Infrastructure.Simulation;

public sealed class SimulatorOptions
{
    public const string Section = "Simulator";

    /// <summary>Generate live telemetry for crew on active missions (demo / development only).</summary>
    public bool Enabled { get; set; }

    public int IntervalSeconds { get; set; } = 5;

    /// <summary>Chance per reading that a medical episode (e.g. tachycardia, hypoxia) begins.</summary>
    public double EpisodeProbability { get; set; } = 0.003;
}

/// <summary>
/// Stands in for onboard sensors. Every tick it records, through the normal service pipeline
/// (so alerts and real-time events behave exactly as with real hardware):
/// <list type="bullet">
/// <item>the cabin environment of each active mission, including the area radiation monitor;</item>
/// <item>every crew member's vitals and personal dosimeter, driven by that environment;</item>
/// <item>once a day, wrist actigraphy (sleep, activity, light), back-filling two weeks of history.</item>
/// </list>
/// </summary>
internal sealed class TelemetrySimulator(
    IServiceScopeFactory scopes,
    IOptions<SimulatorOptions> options,
    ILogger<TelemetrySimulator> logger) : BackgroundService
{
    private const int WellnessHistoryDays = 14;

    private readonly Dictionary<Guid, Physiology> _crew = [];
    private readonly Dictionary<Guid, Habitat> _habitats = [];
    private readonly Dictionary<Guid, DateOnly> _wellnessSyncedOn = [];
    private readonly Random _random = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = options.Value;
        if (!settings.Enabled)
        {
            logger.LogInformation("Telemetry simulator is disabled");
            return;
        }

        logger.LogInformation("Telemetry simulator streaming every {Interval}s", settings.IntervalSeconds);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(1, settings.IntervalSeconds)));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await TickAsync(settings, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Telemetry simulator tick failed");
            }
        }
    }

    private async Task TickAsync(SimulatorOptions settings, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var vitals = scope.ServiceProvider.GetRequiredService<IVitalService>();
        var habitatService = scope.ServiceProvider.GetRequiredService<IHabitatService>();

        var missions = await db.Missions.AsNoTracking()
            .Where(m => m.Status == MissionStatus.Active)
            .Select(m => new { m.Id, m.Destination, Crew = m.Crew.Select(a => a.Id).ToList() })
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        foreach (var mission in missions)
        {
            if (!_habitats.TryGetValue(mission.Id, out var habitat))
            {
                habitat = new Habitat(_random, SpaceEnvironment.BaselineDoseRateMsvPerDay(mission.Destination));
                _habitats[mission.Id] = habitat;
            }

            var cabin = habitat.Next(_random, settings.EpisodeProbability, settings.IntervalSeconds);
            await habitatService.RecordAsync(mission.Id, cabin, ct);

            foreach (var id in mission.Crew)
            {
                if (!_crew.TryGetValue(id, out var body))
                {
                    body = Physiology.CreateBaseline(_random);
                    _crew[id] = body;
                }

                var reading = body.Next(_random, settings.EpisodeProbability, settings.IntervalSeconds, cabin);
                await vitals.RecordAsync(id, reading, ct);

                if (_wellnessSyncedOn.GetValueOrDefault(id) != today)
                {
                    await SyncWellnessAsync(db, id, today, ct);
                    _wellnessSyncedOn[id] = today;
                }
            }
        }
    }

    /// <summary>
    /// Writes the latest night of actigraphy, back-filling any missing days of the last two weeks
    /// so a fresh database shows a realistic history. Each crew member has a stable sleep pattern
    /// (derived from their id), so some carry a sleep debt and others do not.
    /// </summary>
    private static async Task SyncWellnessAsync(IAppDbContext db, Guid astronautId, DateOnly today, CancellationToken ct)
    {
        var from = today.AddDays(-(WellnessHistoryDays - 1));
        var existing = await db.WellnessEntries
            .Where(e => e.AstronautId == astronautId && e.Date >= from)
            .Select(e => e.Date)
            .ToListAsync(ct);

        var seed = astronautId.GetHashCode();
        var person = new Random(seed);
        var baseSleep = 5.6 + person.NextDouble() * 1.8;     // 5.6 to 7.4 h: ISS crews average about 6 h
        var baseMood = 3 + person.Next(0, 2);

        for (var date = from; date <= today; date = date.AddDays(1))
        {
            if (existing.Contains(date))
            {
                continue;
            }

            var night = new Random(HashCode.Combine(seed, date.DayNumber));
            var sleep = Math.Clamp(baseSleep + (night.NextDouble() - 0.5) * 1.6, 3.5, 9.0);
            var entry = new WellnessEntry(
                astronautId,
                date,
                Math.Round((decimal)sleep, 1),
                night.Next(76, 94),
                night.Next(60, 150),                      // includes about 2 h of daily exercise countermeasures
                Math.Round((decimal)(6 + night.NextDouble() * 6), 1));

            // Crew complete a short check-in on most days.
            if (night.NextDouble() < 0.8)
            {
                var mood = Math.Clamp(baseMood + night.Next(-1, 2) - (sleep < 5.5 ? 1 : 0), 1, 5);
                var stress = Math.Clamp(3 + night.Next(-1, 2) + (sleep < 5.5 ? 1 : 0), 1, 5);
                entry.CheckIn(mood, stress, Math.Clamp(3 + night.Next(-1, 2), 1, 5), null,
                    new DateTimeOffset(date.ToDateTime(new TimeOnly(19, 0)), TimeSpan.Zero));
            }

            db.WellnessEntries.Add(entry);
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Cabin environment of one spacecraft: a mean-reverting walk around nominal life-support
    /// values, with occasional system faults and solar particle events.
    /// </summary>
    private sealed class Habitat(Random r, decimal baselineDoseRate)
    {
        private enum Fault { None, ScrubberDegradation, SlowLeak, ThermalFault, SolarParticleEvent }

        private readonly double _baseRate = (double)baselineDoseRate * (0.9 + r.NextDouble() * 0.2);
        private double _co2 = 2.0, _o2 = 21.0, _pressure = 101.3, _temp = 22.5, _humidity = 45, _rate = (double)baselineDoseRate;
        private Fault _fault;
        private int _ticksLeft, _ticksTotal;

        public RecordHabitatRequest Next(Random r, double episodeProbability, int intervalSeconds)
        {
            if (_ticksLeft > 0)
            {
                _ticksLeft--;
            }
            else if (r.NextDouble() < episodeProbability * 0.6)
            {
                _fault = (Fault)r.Next(1, 5);
                // Solar particle events last minutes here (hours in reality); faults develop over 10 to 30 min.
                var minutes = _fault == Fault.SolarParticleEvent ? r.Next(4, 10) : r.Next(10, 31);
                _ticksTotal = _ticksLeft = Math.Max(3, minutes * 60 / Math.Max(1, intervalSeconds));
            }
            else
            {
                _fault = Fault.None;
            }

            var p = _ticksTotal == 0 ? 0 : 1 - (double)_ticksLeft / _ticksTotal;
            var (co2, pressure, temp, rate) = _fault switch
            {
                Fault.ScrubberDegradation => (2.0 + 3.0 * p, 101.3, 22.5, _baseRate),
                Fault.SlowLeak => (2.0, 101.3 - 6.0 * p, 22.5, _baseRate),
                Fault.ThermalFault => (2.0, 101.3, 22.5 + 6.5 * p, _baseRate),
                Fault.SolarParticleEvent => (2.0, 101.3, 22.5, _baseRate * 12 + r.NextDouble() * 20),
                _ => (2.0, 101.3, 22.5, _baseRate)
            };

            _co2 = Drift(r, _co2, co2, 0.08);
            _o2 = Drift(r, _o2, 21.0, 0.08);
            _pressure = Drift(r, _pressure, pressure, 0.15);
            _temp = Drift(r, _temp, temp, 0.1);
            _humidity = Drift(r, _humidity, 45, 0.8);
            _rate = Math.Max(0.05, _rate + (rate - _rate) * 0.5 + (r.NextDouble() - 0.5) * 0.05 * _baseRate);

            return new RecordHabitatRequest(
                Math.Round((decimal)_co2, 2),
                Math.Round((decimal)_o2, 2),
                Math.Round((decimal)_pressure, 2),
                Math.Round((decimal)_temp, 2),
                Math.Round((decimal)_humidity, 1),
                Math.Round((decimal)_rate, 3));
        }

        private static double Drift(Random r, double value, double target, double noise) =>
            value + (target - value) * 0.25 + (r.NextDouble() + r.NextDouble() - 1) * noise;
    }

    /// <summary>Mean-reverting random walk around a personal baseline, with occasional episodes.</summary>
    private sealed class Physiology
    {
        private enum Episode
        {
            None,
            // Acute: develop within a few readings.
            Tachycardia, Hypoxia, Fever, Hypertension,
            // Gradual: worsen steadily over 30–60 minutes — what trend detection is built to catch.
            DevelopingFever, Dehydration, RespiratoryDecline
        }

        private static bool IsGradual(Episode e) => e >= Episode.DevelopingFever;

        private readonly double _baseHr, _baseSys, _baseDia, _baseSpo2, _baseTemp, _baseRr, _shielding;
        private double _hr, _sys, _dia, _spo2, _temp, _rr;
        private Episode _episode;
        private int _episodeTicksLeft;
        private int _episodeTicksTotal;

        private Physiology(Random r)
        {
            _hr = _baseHr = r.Next(60, 78);
            _sys = _baseSys = r.Next(110, 124);
            _dia = _baseDia = r.Next(70, 80);
            _spo2 = _baseSpo2 = 97 + r.NextDouble() * 1.5;
            _temp = _baseTemp = 36.5 + r.NextDouble() * 0.4;
            _rr = _baseRr = r.Next(13, 17);
            _shielding = 0.92 + r.NextDouble() * 0.13; // where the crew member works and sleeps aboard
        }

        public static Physiology CreateBaseline(Random r) => new(r);

        public RecordVitalsRequest Next(Random r, double episodeProbability, int intervalSeconds, RecordHabitatRequest cabin)
        {
            if (_episodeTicksLeft > 0)
            {
                _episodeTicksLeft--;
            }
            else if (r.NextDouble() < episodeProbability)
            {
                _episode = (Episode)r.Next(1, 8);
                _episodeTicksTotal = _episodeTicksLeft = IsGradual(_episode)
                    ? r.Next(30, 61) * 60 / Math.Max(1, intervalSeconds)
                    : r.Next(6, 18);
            }
            else
            {
                _episode = Episode.None;
            }

            // 0 → 1 across a gradual episode, so its targets ramp instead of jumping.
            var p = _episodeTicksTotal == 0 ? 0 : 1 - (double)_episodeTicksLeft / _episodeTicksTotal;

            var (hrTarget, sysTarget, spo2Target, tempTarget, rrTarget) = _episode switch
            {
                Episode.DevelopingFever => (_baseHr + 25 * p, _baseSys, _baseSpo2, _baseTemp + 1.9 * p, _baseRr + 4 * p),
                Episode.Dehydration => (_baseHr + 38 * p, _baseSys - 24 * p, _baseSpo2, _baseTemp + 0.3 * p, _baseRr + 3 * p),
                Episode.RespiratoryDecline => (_baseHr + 15 * p, _baseSys, _baseSpo2 - 6.5 * p, _baseTemp, _baseRr + 9 * p),
                Episode.Tachycardia => (_baseHr + 55, _baseSys + 10, _baseSpo2, _baseTemp, _baseRr + 5),
                Episode.Hypoxia => (_baseHr + 20, _baseSys, 91.5, _baseTemp, _baseRr + 9),
                Episode.Fever => (_baseHr + 18, _baseSys, _baseSpo2 - 1, 38.4, _baseRr + 3),
                Episode.Hypertension => (_baseHr + 8, 152, _baseSpo2, _baseTemp, _baseRr),
                _ => (_baseHr, _baseSys, _baseSpo2, _baseTemp, _baseRr)
            };

            _hr = Drift(r, _hr, hrTarget, 2.0);
            _sys = Drift(r, _sys, sysTarget, 2.0);
            _dia = Drift(r, _dia, _baseDia + (_sys - _baseSys) * 0.4, 1.2);
            _spo2 = Math.Min(100, Drift(r, _spo2, spo2Target, 0.25));
            _temp = Drift(r, _temp, tempTarget, 0.03);
            // High cabin CO2 makes everyone aboard breathe faster.
            var co2Drive = Math.Max(0, (double)cabin.CarbonDioxideMmHg - 3.0) * 2.0;
            _rr = Drift(r, _rr, rrTarget + co2Drive, 0.6);

            // Personal dosimeter: the cabin dose rate, adjusted for where this person is aboard.
            var doseRate = (double)cabin.RadiationDoseRateMsvPerDay * _shielding;
            var dose = doseRate * intervalSeconds / 86_400;

            return new RecordVitalsRequest(
                HeartRateBpm: (int)Math.Round(_hr),
                SystolicMmHg: (int)Math.Round(_sys),
                DiastolicMmHg: (int)Math.Round(Math.Min(_dia, _sys - 20)),
                OxygenSaturationPct: Math.Round((decimal)_spo2, 1),
                BodyTemperatureC: Math.Round((decimal)_temp, 1),
                RespiratoryRatePerMin: (int)Math.Round(_rr),
                RadiationDoseMsv: Math.Round((decimal)dose, 6),
                Notes: _episode == Episode.None ? null : $"Sensor stream · {_episode}",
                RadiationDoseRateMsvPerDay: Math.Round((decimal)doseRate, 3));
        }

        // Pull towards the target (25% per tick) plus Gaussian-ish noise.
        private static double Drift(Random r, double value, double target, double noise) =>
            value + (target - value) * 0.25 + (r.NextDouble() + r.NextDouble() - 1) * noise;
    }
}
