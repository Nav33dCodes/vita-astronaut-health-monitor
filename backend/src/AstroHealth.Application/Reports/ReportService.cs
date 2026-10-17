using AstroHealth.Application.Alerts;
using AstroHealth.Application.Astronauts;
using AstroHealth.Application.Dashboard;
using AstroHealth.Application.Missions;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Common;

namespace AstroHealth.Application.Reports;

// ---- Report models: everything a renderer needs, already assembled from the database ----------

public sealed record CrewReportRow(AstronautSummaryResponse Astronaut, VitalReadingResponse? Latest);

public sealed record FleetReport(
    DateTimeOffset GeneratedAtUtc,
    DashboardSummaryResponse Summary,
    IReadOnlyList<CrewReportRow> Crew,
    IReadOnlyList<AlertResponse> OpenAlerts,
    IReadOnlyList<MissionResponse> Missions,
    IReadOnlyList<ThresholdResponse> Thresholds);

public sealed record AstronautReport(
    DateTimeOffset GeneratedAtUtc,
    int WindowHours,
    AstronautDetailResponse Astronaut,
    HealthAssessmentResponse Assessment,
    VitalStatsResponse Stats,
    VitalSeriesResponse Series,
    IReadOnlyList<AlertResponse> Alerts,
    IReadOnlyList<ThresholdResponse> Thresholds);

public sealed record AlertsReport(DateTimeOffset GeneratedAtUtc, AlertQuery Filter, IReadOnlyList<AlertResponse> Alerts);

public sealed record VitalsReport(
    DateTimeOffset GeneratedAtUtc,
    int WindowHours,
    AstronautDetailResponse Astronaut,
    IReadOnlyList<VitalReadingResponse> Readings,
    IReadOnlyList<ThresholdResponse> Thresholds);

/// <summary>A rendered file ready to stream to the client.</summary>
public sealed record ReportFile(byte[] Content, string ContentType, string FileName);

/// <summary>Turns report models into documents. Implemented in Infrastructure (QuestPDF / ClosedXML).</summary>
public interface IReportRenderer
{
    ReportFile FleetPdf(FleetReport report);
    ReportFile AstronautPdf(AstronautReport report);
    ReportFile CrewExcel(FleetReport report);
    ReportFile AlertsExcel(AlertsReport report);
    ReportFile VitalsExcel(VitalsReport report);
}

public interface IReportService
{
    Task<ReportFile> FleetPdfAsync(CancellationToken ct);
    Task<ReportFile> CrewExcelAsync(CancellationToken ct);
    Task<ReportFile> AlertsExcelAsync(AlertStatus? status, AlertSeverity? severity, CancellationToken ct);
    Task<Result<ReportFile>> AstronautPdfAsync(Guid astronautId, int windowHours, CancellationToken ct);
    Task<Result<ReportFile>> VitalsExcelAsync(Guid astronautId, int windowHours, CancellationToken ct);
}

/// <summary>Assembles report data through the same services the API uses, so reports never disagree with the UI.</summary>
internal sealed class ReportService(
    IDashboardService dashboard,
    IAstronautService astronauts,
    IAlertService alerts,
    IMissionService missions,
    IVitalService vitals,
    IHealthAssessmentService assessments,
    IReportRenderer renderer,
    TimeProvider clock) : IReportService
{
    // Upper bounds keep a single export from loading an unbounded table into memory.
    private const int MaxAlerts = 10_000;
    private const int MaxReadings = 50_000;
    private const int ChartBuckets = 96;

    public async Task<ReportFile> FleetPdfAsync(CancellationToken ct) => renderer.FleetPdf(await BuildFleetAsync(ct));

    public async Task<ReportFile> CrewExcelAsync(CancellationToken ct) => renderer.CrewExcel(await BuildFleetAsync(ct));

    public async Task<ReportFile> AlertsExcelAsync(AlertStatus? status, AlertSeverity? severity, CancellationToken ct)
    {
        var filter = new AlertQuery(status, severity, PageSize: MaxAlerts);
        var page = await alerts.ListAsync(filter, ct);
        return renderer.AlertsExcel(new AlertsReport(clock.GetUtcNow(), filter, page.Items));
    }

    public async Task<Result<ReportFile>> AstronautPdfAsync(Guid astronautId, int windowHours, CancellationToken ct)
    {
        var astronaut = await astronauts.GetAsync(astronautId, ct);
        if (astronaut.IsFailure)
        {
            return astronaut.Error;
        }

        var assessment = await assessments.AssessAsync(astronautId, 60, ct);
        var stats = await vitals.GetStatsAsync(astronautId, windowHours, ct);
        var series = await vitals.GetSeriesAsync(astronautId, windowHours, ChartBuckets, ct);
        var history = await alerts.ListAsync(new AlertQuery(AstronautId: astronautId, PageSize: 25), ct);

        return renderer.AstronautPdf(new AstronautReport(
            clock.GetUtcNow(), windowHours, astronaut.Value, assessment.Value, stats.Value, series.Value,
            history.Items, vitals.GetThresholds()));
    }

    public async Task<Result<ReportFile>> VitalsExcelAsync(Guid astronautId, int windowHours, CancellationToken ct)
    {
        var astronaut = await astronauts.GetAsync(astronautId, ct);
        if (astronaut.IsFailure)
        {
            return astronaut.Error;
        }

        var now = clock.GetUtcNow();
        var readings = await vitals.ListAsync(astronautId, new VitalsQuery(now.AddHours(-windowHours), now, 1, MaxReadings), ct);

        // The list endpoint is newest-first; a spreadsheet reads naturally oldest-first.
        var ordered = readings.Value.Items.OrderBy(r => r.RecordedAtUtc).ToList();
        return renderer.VitalsExcel(new VitalsReport(now, windowHours, astronaut.Value, ordered, vitals.GetThresholds()));
    }

    private async Task<FleetReport> BuildFleetAsync(CancellationToken ct)
    {
        var summary = await dashboard.GetSummaryAsync(ct);
        var roster = await astronauts.ListAsync(new AstronautQuery(PageSize: 500), ct);

        var latest = await vitals.GetLatestReadingsAsync(ct);
        var crew = roster.Items.Select(member => new CrewReportRow(member, latest.GetValueOrDefault(member.Id))).ToList();

        var open = await alerts.ListAsync(new AlertQuery(Status: AlertStatus.Open, PageSize: 50), ct);
        var missionList = await missions.ListAsync(null, ct);

        return new FleetReport(clock.GetUtcNow(), summary, crew, open.Items, missionList, vitals.GetThresholds());
    }
}
