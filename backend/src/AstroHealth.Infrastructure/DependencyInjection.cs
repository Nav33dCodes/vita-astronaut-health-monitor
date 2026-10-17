using AstroHealth.Application.Abstractions;
using AstroHealth.Application.Alerts;
using AstroHealth.Infrastructure.Maintenance;
using AstroHealth.Infrastructure.Persistence;
using AstroHealth.Infrastructure.Simulation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AstroHealth.Infrastructure;

public enum DatabaseProvider
{
    /// <summary>Production (Neon / any PostgreSQL). Schema managed by migrations.</summary>
    Postgres,

    /// <summary>Zero-setup local runs and tests. Schema created directly from the model.</summary>
    Sqlite
}

public static class DependencyInjection
{
    private const string MissingConnectionHelp =
        "Connection string 'Default' is not configured. For local development run: " +
        "dotnet user-secrets set \"ConnectionStrings:Default\" \"<neon connection string>\" --project src/AstroHealth.Api " +
        "(or set the ConnectionStrings__Default environment variable).";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var provider = configuration.GetValue("Database:Provider", DatabaseProvider.Postgres);
        var connectionString = configuration.GetConnectionString("Default");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(MissingConnectionHelp);
        }

        services.AddSingleton<AuditInterceptor>();

        // Pooled contexts: reused instances avoid per-request allocation on hot telemetry paths.
        services.AddDbContextPool<AppDbContext>((sp, options) =>
        {
            Configure(options, provider, connectionString);
            options.AddInterceptors(sp.GetRequiredService<AuditInterceptor>());
        });
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddScoped<DataSeeder>();

        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

        services.Configure<SimulatorOptions>(configuration.GetSection(SimulatorOptions.Section));
        services.AddHostedService<TelemetrySimulator>();

        services.AddOptions<RetentionOptions>()
            .Bind(configuration.GetSection(RetentionOptions.Section))
            .ValidateDataAnnotations()
            .ValidateOnStart();
        services.AddHostedService<TelemetryRetentionService>();

        services.AddOptions<EscalationPolicy>()
            .Bind(configuration.GetSection(EscalationPolicy.Section))
            .ValidateDataAnnotations()
            .ValidateOnStart();
        services.AddHostedService<AlertEscalationWorker>();

        return services;
    }

    private static void Configure(DbContextOptionsBuilder options, DatabaseProvider provider, string connectionString)
    {
        if (provider == DatabaseProvider.Sqlite)
        {
            options.UseSqlite(connectionString);
            return;
        }

        options.UseNpgsql(PostgresConnection.Normalize(connectionString), npgsql =>
            // Transient network blips and serverless cold starts are retried automatically.
            npgsql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorCodesToAdd: null));
    }

    /// <summary>Brings the schema up to date and, when enabled, seeds demo data.</summary>
    public static async Task InitialiseDatabaseAsync(this IHost host, bool seed, CancellationToken ct = default)
    {
        await using var scope = host.Services.CreateAsyncScope();
        var services = scope.ServiceProvider;
        var configuration = services.GetRequiredService<IConfiguration>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("Database");
        var db = services.GetRequiredService<AppDbContext>();

        if (db.Database.IsNpgsql())
        {
            // Migrations run over a direct (non-pooled) connection — see PostgresConnection.ForMigrations.
            var direct = configuration.GetConnectionString("Migrations") ?? configuration.GetConnectionString("Default")!;
            var migrationOptions = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(PostgresConnection.ForMigrations(direct))
                .Options;

            await using var migrator = new AppDbContext(migrationOptions);
            var pending = (await migrator.Database.GetPendingMigrationsAsync(ct)).ToList();
            if (pending.Count > 0)
            {
                logger.LogInformation("Applying {Count} migration(s): {Migrations}", pending.Count, string.Join(", ", pending));
                await migrator.Database.MigrateAsync(ct);
            }
        }
        else
        {
            await db.Database.EnsureCreatedAsync(ct);
            await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;", ct);
        }

        if (seed)
        {
            await services.GetRequiredService<DataSeeder>().SeedAsync(ct);
        }
    }
}

internal sealed class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default) =>
        await db.Database.CanConnectAsync(ct)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy("Cannot connect to the database.");
}
