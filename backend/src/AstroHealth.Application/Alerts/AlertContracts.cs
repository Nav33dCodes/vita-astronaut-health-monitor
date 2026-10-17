using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Vitals;
using FluentValidation;

namespace AstroHealth.Application.Alerts;

public sealed record AlertResponse(
    Guid Id,
    Guid AstronautId,
    string AstronautName,
    VitalMetric Metric,
    AlertSeverity Severity,
    AlertStatus Status,
    decimal ObservedValue,
    string Message,
    DateTimeOffset RaisedAtUtc,
    DateTimeOffset? AcknowledgedAtUtc,
    DateTimeOffset? ResolvedAtUtc,
    string? ResolutionNote,
    int EscalationLevel,
    DateTimeOffset? EscalatedAtUtc)
{
    public static AlertResponse From(HealthAlert a, string astronautName) => new(
        a.Id, a.AstronautId, astronautName, a.Metric, a.Severity, a.Status, a.ObservedValue, a.Message,
        a.RaisedAtUtc, a.AcknowledgedAtUtc, a.ResolvedAtUtc, a.ResolutionNote, a.EscalationLevel, a.EscalatedAtUtc);
}

public sealed record AlertQuery(
    AlertStatus? Status = null,
    AlertSeverity? Severity = null,
    Guid? AstronautId = null,
    bool? Escalated = null,
    int Page = 1,
    int PageSize = 20);

public sealed record ResolveAlertRequest(string? Note);

public sealed class AlertQueryValidator : AbstractValidator<AlertQuery>
{
    public AlertQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
        RuleFor(x => x.Status).IsInEnum().When(x => x.Status.HasValue);
        RuleFor(x => x.Severity).IsInEnum().When(x => x.Severity.HasValue);
    }
}

public sealed class ResolveAlertRequestValidator : AbstractValidator<ResolveAlertRequest>
{
    public ResolveAlertRequestValidator()
    {
        RuleFor(x => x.Note).MaximumLength(500);
    }
}
