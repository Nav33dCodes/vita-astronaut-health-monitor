using AstroHealth.Application.Abstractions;
using AstroHealth.Application.Alerts;
using AstroHealth.Application.Astronauts;
using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Missions;
using Microsoft.EntityFrameworkCore;

namespace AstroHealth.Application.Dashboard;

public sealed record CrewHealthBreakdown(int Nominal, int Caution, int Critical, int Unknown);

public sealed record DashboardSummaryResponse(
    int ActiveMissions,
    int TotalCrew,
    CrewHealthBreakdown CrewHealth,
    int OpenAlerts,
    int OpenCriticalAlerts,
    int EscalatedAlerts,
    int ReadingsLast24Hours,
    IReadOnlyList<AlertResponse> RecentAlerts);

public interface IDashboardService
{
    Task<DashboardSummaryResponse> GetSummaryAsync(CancellationToken ct);
}

internal sealed class DashboardService(IAppDbContext db, IAlertService alerts, TimeProvider clock) : IDashboardService
{
    public async Task<DashboardSummaryResponse> GetSummaryAsync(CancellationToken ct)
    {
        var since = clock.GetUtcNow().AddHours(-24);

        var activeMissions = await db.Missions.CountAsync(m => m.Status == MissionStatus.Active, ct);

        var crew = await db.Astronauts.AsNoTracking()
            .Select(a => new
            {
                OpenCritical = a.Alerts.Count(x => x.Status != AlertStatus.Resolved && x.Severity == AlertSeverity.Critical),
                OpenWarning = a.Alerts.Count(x => x.Status != AlertStatus.Resolved && x.Severity == AlertSeverity.Warning),
                HasReadings = a.Readings.Any()
            })
            .ToListAsync(ct);

        var statuses = crew
            .Select(c => HealthStatusRules.From(c.OpenCritical, c.OpenWarning, c.HasReadings))
            .ToList();

        var openAlerts = crew.Sum(c => c.OpenCritical + c.OpenWarning);
        var openCritical = crew.Sum(c => c.OpenCritical);
        var readings24h = await db.VitalReadings.CountAsync(r => r.RecordedAtUtc >= since, ct);
        var escalated = await db.HealthAlerts.CountAsync(a => a.Status == AlertStatus.Open && a.EscalationLevel > 0, ct);

        var recent = await alerts.ListAsync(new AlertQuery(Status: AlertStatus.Open, PageSize: 5), ct);

        return new DashboardSummaryResponse(
            activeMissions,
            crew.Count,
            new CrewHealthBreakdown(
                statuses.Count(s => s == HealthStatus.Nominal),
                statuses.Count(s => s == HealthStatus.Caution),
                statuses.Count(s => s == HealthStatus.Critical),
                statuses.Count(s => s == HealthStatus.Unknown)),
            openAlerts,
            openCritical,
            escalated,
            readings24h,
            recent.Items);
    }
}
