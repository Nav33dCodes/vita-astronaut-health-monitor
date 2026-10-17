using AstroHealth.Application.Abstractions;
using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Missions;
using AstroHealth.Domain.Vitals;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AstroHealth.Infrastructure.Persistence;

/// <summary>
/// Options-only constructor so the context can be pooled; cross-cutting behaviour
/// (audit timestamps) lives in interceptors.
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<Mission> Missions => Set<Mission>();
    public DbSet<Astronaut> Astronauts => Set<Astronaut>();
    public DbSet<VitalReading> VitalReadings => Set<VitalReading>();
    public DbSet<VitalRollup> VitalRollups => Set<VitalRollup>();
    public DbSet<HealthAlert> HealthAlerts => Set<HealthAlert>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        // Store enums as readable strings.
        builder.Properties<MissionStatus>().HaveConversion<string>().HaveMaxLength(32);
        builder.Properties<MissionDestination>().HaveConversion<string>().HaveMaxLength(32);
        builder.Properties<CrewRole>().HaveConversion<string>().HaveMaxLength(32);
        builder.Properties<VitalMetric>().HaveConversion<string>().HaveMaxLength(32);
        builder.Properties<AlertSeverity>().HaveConversion<string>().HaveMaxLength(16);
        builder.Properties<AlertStatus>().HaveConversion<string>().HaveMaxLength(16);

        // SQLite (local quick-start and tests only) cannot order DateTimeOffset natively.
        if (Database.IsSqlite())
        {
            builder.Properties<DateTimeOffset>().HaveConversion<DateTimeOffsetToBinaryConverter>();
        }
    }
}
