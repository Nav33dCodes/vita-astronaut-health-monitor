using System.ComponentModel.DataAnnotations;
using AstroHealth.Application.Abstractions;
using AstroHealth.Domain.Alerts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AstroHealth.Application.Alerts;

/// <summary>How long an alert may stay unacknowledged before it escalates, and how fast it climbs.</summary>
public sealed class EscalationPolicy
{
    public const string Section = "Escalation";

    public bool Enabled { get; set; } = true;

    [Range(1, 1440)]
    public int CriticalAckMinutes { get; set; } = 2;

    [Range(1, 1440)]
    public int WarningAckMinutes { get; set; } = 15;

    /// <summary>Each further interval without acknowledgement adds one level.</summary>
    [Range(1, 1440)]
    public int RepeatMinutes { get; set; } = 5;

    [Range(1, 10)]
    public int MaxLevel { get; set; } = 3;

    [Range(5, 3600)]
    public int CheckIntervalSeconds { get; set; } = 15;

    /// <summary>Level an alert of this age should be at (0 = not due yet).</summary>
    public int LevelFor(AlertSeverity severity, TimeSpan unacknowledgedFor)
    {
        var ackWindow = TimeSpan.FromMinutes(severity == AlertSeverity.Critical ? CriticalAckMinutes : WarningAckMinutes);
        if (unacknowledgedFor < ackWindow)
        {
            return 0;
        }

        var extraIntervals = (int)((unacknowledgedFor - ackWindow) / TimeSpan.FromMinutes(RepeatMinutes));
        return Math.Min(MaxLevel, 1 + extraIntervals);
    }
}

public interface IAlertEscalationService
{
    /// <summary>Escalates every open alert that has waited too long; returns the ones that changed.</summary>
    Task<IReadOnlyList<AlertResponse>> EscalateDueAsync(CancellationToken ct);
}

internal sealed class AlertEscalationService(
    IAppDbContext db,
    ITelemetryPublisher publisher,
    IOptions<EscalationPolicy> policy,
    TimeProvider clock,
    ILogger<AlertEscalationService> logger) : IAlertEscalationService
{
    public async Task<IReadOnlyList<AlertResponse>> EscalateDueAsync(CancellationToken ct)
    {
        var rules = policy.Value;
        var now = clock.GetUtcNow();

        // Earliest moment any alert can become due — keeps the scan to candidates only.
        var oldestDue = now.AddMinutes(-Math.Min(rules.CriticalAckMinutes, rules.WarningAckMinutes));

        var candidates = await db.HealthAlerts
            .Include(a => a.Astronaut)
            .Where(a => a.Status == AlertStatus.Open && a.EscalationLevel < rules.MaxLevel && a.RaisedAtUtc <= oldestDue)
            .ToListAsync(ct);

        var escalated = candidates
            .Where(a => a.EscalateTo(rules.LevelFor(a.Severity, now - a.RaisedAtUtc), now))
            .ToList();

        if (escalated.Count == 0)
        {
            return [];
        }

        await db.SaveChangesAsync(ct);

        var responses = escalated
            .Select(a => AlertResponse.From(a, $"{a.Astronaut.FirstName} {a.Astronaut.LastName}"))
            .ToList();

        foreach (var alert in responses)
        {
            logger.LogWarning("Escalated {Severity} alert {AlertId} for {Astronaut} to level {Level}",
                alert.Severity, alert.Id, alert.AstronautName, alert.EscalationLevel);
            await publisher.AlertEscalatedAsync(alert, CancellationToken.None);
        }

        return responses;
    }
}
