using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Common;
using AstroHealth.Domain.Vitals;

namespace AstroHealth.Domain.Alerts;

public enum AlertSeverity
{
    Warning,
    Critical
}

public enum AlertStatus
{
    Open,
    Acknowledged,
    Resolved
}

public sealed class HealthAlert : Entity
{
    private HealthAlert() { } // EF Core

    private HealthAlert(Guid astronautId, Guid? vitalReadingId, HealthFinding finding, DateTimeOffset raisedAtUtc)
    {
        AstronautId = astronautId;
        VitalReadingId = vitalReadingId;
        Metric = finding.Metric;
        Severity = finding.Severity;
        ObservedValue = finding.ObservedValue;
        Message = finding.Message;
        Status = AlertStatus.Open;
        RaisedAtUtc = raisedAtUtc;
    }

    public Guid AstronautId { get; private set; }
    public Astronaut Astronaut { get; private set; } = null!;
    /// <summary>The reading that triggered the alert; cleared once that raw reading is rolled up by retention.</summary>
    public Guid? VitalReadingId { get; private set; }
    public VitalMetric Metric { get; private set; }
    public AlertSeverity Severity { get; private set; }
    public decimal ObservedValue { get; private set; }
    public string Message { get; private set; } = null!;
    public AlertStatus Status { get; private set; }
    public DateTimeOffset RaisedAtUtc { get; private set; }
    public DateTimeOffset? AcknowledgedAtUtc { get; private set; }
    public DateTimeOffset? ResolvedAtUtc { get; private set; }
    public string? ResolutionNote { get; private set; }

    /// <summary>0 = not escalated. Rises while the alert stays unacknowledged.</summary>
    public int EscalationLevel { get; private set; }

    public DateTimeOffset? EscalatedAtUtc { get; private set; }

    public static HealthAlert Raise(VitalReading reading, HealthFinding finding) =>
        new(reading.AstronautId, reading.Id, finding, reading.RecordedAtUtc);

    /// <summary>
    /// Raises the escalation level of an alert nobody has acknowledged. Returns false when there
    /// is nothing to do (already handled, or already at/above the requested level).
    /// </summary>
    public bool EscalateTo(int level, DateTimeOffset nowUtc)
    {
        if (Status != AlertStatus.Open || level <= EscalationLevel)
        {
            return false;
        }

        EscalationLevel = level;
        EscalatedAtUtc = nowUtc;
        return true;
    }

    public Result Acknowledge(DateTimeOffset nowUtc)
    {
        if (Status != AlertStatus.Open)
        {
            return AlertErrors.InvalidTransition(Id, Status, AlertStatus.Acknowledged);
        }

        Status = AlertStatus.Acknowledged;
        AcknowledgedAtUtc = nowUtc;
        return Result.Success();
    }

    public Result Resolve(DateTimeOffset nowUtc, string? note)
    {
        if (Status == AlertStatus.Resolved)
        {
            return AlertErrors.InvalidTransition(Id, Status, AlertStatus.Resolved);
        }

        AcknowledgedAtUtc ??= nowUtc;
        Status = AlertStatus.Resolved;
        ResolvedAtUtc = nowUtc;
        ResolutionNote = note;
        return Result.Success();
    }
}

public static class AlertErrors
{
    public static Error NotFound(Guid id) => Error.NotFound("Alert.NotFound", $"Alert '{id}' was not found.");

    public static Error InvalidTransition(Guid id, AlertStatus from, AlertStatus to) =>
        Error.Conflict("Alert.InvalidTransition", $"Alert '{id}' cannot move from {from} to {to}.");
}
