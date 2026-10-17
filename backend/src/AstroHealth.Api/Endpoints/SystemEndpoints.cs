using System.Diagnostics;
using System.Reflection;
using AstroHealth.Api.Realtime;
using AstroHealth.Application.Alerts;
using AstroHealth.Infrastructure;
using AstroHealth.Infrastructure.Maintenance;
using AstroHealth.Infrastructure.Simulation;
using Microsoft.Extensions.Options;

namespace AstroHealth.Api.Endpoints;

public sealed record SimulatorStatus(bool Enabled, int IntervalSeconds);

public sealed record EscalationStatus(bool Enabled, int CriticalAckMinutes, int WarningAckMinutes, int RepeatMinutes, int MaxLevel);

public sealed record RetentionStatus(bool Enabled, int RawRetentionDays, int RollupRetentionDays);

public sealed record SystemStatusResponse(
    string Version,
    string Environment,
    DateTimeOffset ServerTimeUtc,
    long UptimeSeconds,
    int RealtimeClients,
    string RealtimeHub,
    string Database,
    SimulatorStatus Simulator,
    EscalationStatus Escalation,
    RetentionStatus Retention);

internal static class SystemEndpoints
{
    // Process start, not first request — a static initializer would only run on first use.
    private static readonly DateTimeOffset StartedAt = Process.GetCurrentProcess().StartTime.ToUniversalTime();

    private static readonly string Version =
        Assembly.GetExecutingAssembly().GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0]
        ?? "1.0.0";

    public static IEndpointRouteBuilder MapSystemEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("system/status", (
                IHostEnvironment env,
                ConnectionTracker connections,
                IOptions<SimulatorOptions> simulator,
                IOptions<EscalationPolicy> escalation,
                IOptions<RetentionOptions> retention,
                IConfiguration configuration,
                TimeProvider clock) =>
            {
                var now = clock.GetUtcNow();
                return TypedResults.Ok(new SystemStatusResponse(
                    Version,
                    env.EnvironmentName,
                    now,
                    (long)(now - StartedAt).TotalSeconds,
                    connections.Count,
                    TelemetryHub.Path,
                    configuration.GetValue("Database:Provider", DatabaseProvider.Postgres) == DatabaseProvider.Postgres ? "PostgreSQL" : "SQLite (local)",
                    new SimulatorStatus(simulator.Value.Enabled, simulator.Value.IntervalSeconds),
                    new EscalationStatus(
                        escalation.Value.Enabled, escalation.Value.CriticalAckMinutes, escalation.Value.WarningAckMinutes,
                        escalation.Value.RepeatMinutes, escalation.Value.MaxLevel),
                    new RetentionStatus(retention.Value.Enabled, retention.Value.RawRetentionDays, retention.Value.RollupRetentionDays)));
            })
            .WithTags("System")
            .WithName("GetSystemStatus")
            .WithSummary("Ground-segment status: uptime, real-time clients, simulator, escalation and retention policy");

        return app;
    }
}
