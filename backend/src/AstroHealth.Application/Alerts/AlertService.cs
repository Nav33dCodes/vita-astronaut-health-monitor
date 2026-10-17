using AstroHealth.Application.Abstractions;
using AstroHealth.Application.Common;
using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace AstroHealth.Application.Alerts;

public interface IAlertService
{
    Task<PagedResult<AlertResponse>> ListAsync(AlertQuery query, CancellationToken ct);
    Task<Result<AlertResponse>> AcknowledgeAsync(Guid id, CancellationToken ct);
    Task<Result<AlertResponse>> ResolveAsync(Guid id, ResolveAlertRequest request, CancellationToken ct);
}

internal sealed class AlertService(IAppDbContext db, ITelemetryPublisher publisher, TimeProvider clock) : IAlertService
{
    public Task<PagedResult<AlertResponse>> ListAsync(AlertQuery query, CancellationToken ct)
    {
        var alerts = db.HealthAlerts.AsNoTracking();

        if (query.Status is not null)
        {
            alerts = alerts.Where(a => a.Status == query.Status);
        }

        if (query.Severity is not null)
        {
            alerts = alerts.Where(a => a.Severity == query.Severity);
        }

        if (query.AstronautId is not null)
        {
            alerts = alerts.Where(a => a.AstronautId == query.AstronautId);
        }

        if (query.Escalated is { } escalated)
        {
            alerts = escalated ? alerts.Where(a => a.EscalationLevel > 0) : alerts.Where(a => a.EscalationLevel == 0);
        }

        return alerts
            // Open first, then acknowledged, then resolved; critical before warning; most escalated; newest first.
            .OrderBy(a => a.Status == AlertStatus.Open ? 0 : a.Status == AlertStatus.Acknowledged ? 1 : 2)
            .ThenBy(a => a.Severity == AlertSeverity.Critical ? 0 : 1)
            .ThenByDescending(a => a.EscalationLevel)
            .ThenByDescending(a => a.RaisedAtUtc)
            .Select(a => new AlertResponse(
                a.Id, a.AstronautId, a.Astronaut.FirstName + " " + a.Astronaut.LastName,
                a.Metric, a.Severity, a.Status, a.ObservedValue, a.Message,
                a.RaisedAtUtc, a.AcknowledgedAtUtc, a.ResolvedAtUtc, a.ResolutionNote, a.EscalationLevel, a.EscalatedAtUtc))
            .ToPagedResultAsync(query.Page, query.PageSize, ct);
    }

    public Task<Result<AlertResponse>> AcknowledgeAsync(Guid id, CancellationToken ct) =>
        TransitionAsync(id, alert => alert.Acknowledge(clock.GetUtcNow()), ct);

    public Task<Result<AlertResponse>> ResolveAsync(Guid id, ResolveAlertRequest request, CancellationToken ct) =>
        TransitionAsync(id, alert => alert.Resolve(clock.GetUtcNow(), request.Note), ct);

    private async Task<Result<AlertResponse>> TransitionAsync(Guid id, Func<HealthAlert, Result> transition, CancellationToken ct)
    {
        var alert = await db.HealthAlerts.Include(a => a.Astronaut).FirstOrDefaultAsync(a => a.Id == id, ct);
        if (alert is null)
        {
            return AlertErrors.NotFound(id);
        }

        var result = transition(alert);
        if (result.IsFailure)
        {
            return result.Error;
        }

        await db.SaveChangesAsync(ct);

        var response = AlertResponse.From(alert, $"{alert.Astronaut.FirstName} {alert.Astronaut.LastName}");
        await publisher.AlertUpdatedAsync(response, CancellationToken.None);
        return response;
    }
}
