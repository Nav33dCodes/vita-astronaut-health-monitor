using AstroHealth.Application.Abstractions;
using AstroHealth.Application.Vitals;
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
/// Stands in for on-board biomedical sensors: streams vitals for every astronaut on an
/// active mission through the normal <see cref="IVitalService"/> pipeline, so alerts and
/// real-time events behave exactly as they would with real hardware.
/// </summary>
internal sealed class TelemetrySimulator(
    IServiceScopeFactory scopes,
    IOptions<SimulatorOptions> options,
    ILogger<TelemetrySimulator> logger) : BackgroundService
{
    private readonly Dictionary<Guid, Physiology> _crew = [];
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

        var activeCrew = await db.Astronauts.AsNoTracking()
            .Where(a => a.Mission != null && a.Mission.Status == MissionStatus.Active)
            .Select(a => a.Id)
            .ToListAsync(ct);

        foreach (var id in activeCrew)
        {
            if (!_crew.TryGetValue(id, out var body))
            {
                body = Physiology.CreateBaseline(_random);
                _crew[id] = body;
            }

            await vitals.RecordAsync(id, body.Next(_random, settings.EpisodeProbability, settings.IntervalSeconds), ct);
        }
    }

    /// <summary>Mean-reverting random walk around a personal baseline, with occasional episodes.</summary>
    private sealed class Physiology
    {
        private enum Episode
        {
            None,
            // Acute: develop within a few readings.
            Tachycardia, Hypoxia, Fever, Hypertension, SolarParticleEvent,
            // Gradual: worsen steadily over 30–60 minutes — what trend detection is built to catch.
            DevelopingFever, Dehydration, RespiratoryDecline
        }

        private static bool IsGradual(Episode e) => e >= Episode.DevelopingFever;

        private readonly double _baseHr, _baseSys, _baseDia, _baseSpo2, _baseTemp, _baseRr;
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
        }

        public static Physiology CreateBaseline(Random r) => new(r);

        public RecordVitalsRequest Next(Random r, double episodeProbability, int intervalSeconds)
        {
            if (_episodeTicksLeft > 0)
            {
                _episodeTicksLeft--;
            }
            else if (r.NextDouble() < episodeProbability)
            {
                _episode = (Episode)r.Next(1, 9);
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
            _rr = Drift(r, _rr, rrTarget, 0.6);

            var radiation = _episode == Episode.SolarParticleEvent
                ? 1.1 + r.NextDouble() * 0.6
                : 0.0005 + r.NextDouble() * 0.003;

            return new RecordVitalsRequest(
                HeartRateBpm: (int)Math.Round(_hr),
                SystolicMmHg: (int)Math.Round(_sys),
                DiastolicMmHg: (int)Math.Round(Math.Min(_dia, _sys - 20)),
                OxygenSaturationPct: Math.Round((decimal)_spo2, 1),
                BodyTemperatureC: Math.Round((decimal)_temp, 1),
                RespiratoryRatePerMin: (int)Math.Round(_rr),
                RadiationDoseMsv: Math.Round((decimal)radiation, 4),
                Notes: _episode == Episode.None ? null : $"Sensor stream · {_episode}");
        }

        // Pull towards the target (25% per tick) plus Gaussian-ish noise.
        private static double Drift(Random r, double value, double target, double noise) =>
            value + (target - value) * 0.25 + (r.NextDouble() + r.NextDouble() - 1) * noise;
    }
}
