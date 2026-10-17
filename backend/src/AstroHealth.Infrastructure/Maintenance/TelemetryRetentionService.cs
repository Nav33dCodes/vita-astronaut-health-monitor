using System.ComponentModel.DataAnnotations;
using AstroHealth.Domain.Vitals;
using AstroHealth.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AstroHealth.Infrastructure.Maintenance;

public sealed class RetentionOptions
{
    public const string Section = "Retention";

    public bool Enabled { get; set; } = true;

    /// <summary>Raw readings older than this are rolled up into hourly aggregates and deleted.</summary>
    [Range(2, 3650)]
    public int RawRetentionDays { get; set; } = 7;

    [Range(30, 36500)]
    public int RollupRetentionDays { get; set; } = 730;

    [Range(1, 1440)]
    public int IntervalMinutes { get; set; } = 60;

    /// <summary>Upper bound of hours processed per run, so a large backlog never blocks for long.</summary>
    [Range(1, 10000)]
    public int MaxHoursPerRun { get; set; } = 168;
}

/// <summary>
/// Keeps the telemetry store bounded: folds raw readings past the retention window into hourly
/// <see cref="VitalRollup"/> rows (one transaction per hour, safe to re-run), then prunes old rollups.
/// </summary>
internal sealed class TelemetryRetentionService(
    IServiceScopeFactory scopes,
    IOptions<RetentionOptions> options,
    TimeProvider clock,
    ILogger<TelemetryRetentionService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = options.Value;
        if (!settings.Enabled)
        {
            logger.LogInformation("Telemetry retention is disabled");
            return;
        }

        // Let startup (migrations, seeding) settle before the first pass.
        await Task.Delay(TimeSpan.FromSeconds(30), clock, stoppingToken);

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(settings.IntervalMinutes), clock);
        do
        {
            try
            {
                await RunOnceAsync(settings, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Telemetry retention pass failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    internal async Task RunOnceAsync(RetentionOptions settings, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cutoff = FloorToHour(clock.GetUtcNow().AddDays(-settings.RawRetentionDays));

        var hoursRolled = 0;
        var readingsRolled = 0;
        while (hoursRolled < settings.MaxHoursPerRun)
        {
            var oldest = await db.VitalReadings
                .Where(r => r.RecordedAtUtc < cutoff)
                .OrderBy(r => r.RecordedAtUtc)
                .Select(r => (DateTimeOffset?)r.RecordedAtUtc)
                .FirstOrDefaultAsync(ct);

            if (oldest is null)
            {
                break;
            }

            readingsRolled += await RollUpHourAsync(db, FloorToHour(oldest.Value), ct);
            hoursRolled++;
        }

        var rollupCutoff = clock.GetUtcNow().AddDays(-settings.RollupRetentionDays);
        var rollupsPruned = await db.VitalRollups.Where(r => r.BucketStartUtc < rollupCutoff).ExecuteDeleteAsync(ct);

        if (readingsRolled > 0 || rollupsPruned > 0)
        {
            logger.LogInformation(
                "Retention: rolled {Readings} readings into {Hours} hourly buckets, pruned {Rollups} rollups",
                readingsRolled, hoursRolled, rollupsPruned);
        }
    }

    private static async Task<int> RollUpHourAsync(AppDbContext db, DateTimeOffset hourStart, CancellationToken ct)
    {
        var hourEnd = hourStart.AddHours(1);

        // Execution strategy + explicit transaction: retries replay the whole unit of work.
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);

            var readings = await db.VitalReadings
                .Where(r => r.RecordedAtUtc >= hourStart && r.RecordedAtUtc < hourEnd)
                .AsNoTracking()
                .ToListAsync(ct);

            foreach (var group in readings.GroupBy(r => r.AstronautId))
            {
                var rollup = VitalRollup.From(group.Key, hourStart, group.ToList());
                var existing = await db.VitalRollups.FindAsync([group.Key, hourStart], ct);
                if (existing is null)
                {
                    db.VitalRollups.Add(rollup);
                }
                else
                {
                    existing.Absorb(rollup);
                }
            }

            await db.SaveChangesAsync(ct);
            await db.VitalReadings
                .Where(r => r.RecordedAtUtc >= hourStart && r.RecordedAtUtc < hourEnd)
                .ExecuteDeleteAsync(ct);

            await transaction.CommitAsync(ct);
            return readings.Count;
        });
    }

    private static DateTimeOffset FloorToHour(DateTimeOffset value)
    {
        var utc = value.UtcDateTime;
        return new DateTimeOffset(utc.Year, utc.Month, utc.Day, utc.Hour, 0, 0, TimeSpan.Zero);
    }
}
