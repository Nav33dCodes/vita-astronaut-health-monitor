using AstroHealth.Api.Infrastructure;
using AstroHealth.Application.Reports;
using AstroHealth.Domain.Alerts;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AstroHealth.Api.Endpoints;

/// <summary>Downloadable PDF and Excel reports, generated on demand from live data.</summary>
internal static class ReportEndpoints
{
    private const int MaxWindowHours = 24 * 7;

    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("reports").WithTags("Reports");

        group.MapGet("fleet.pdf", async (IReportService reports, CancellationToken ct) => File(await reports.FleetPdfAsync(ct)))
            .WithName("GetFleetReportPdf").WithSummary("Fleet health report (PDF)");

        group.MapGet("crew.xlsx", async (IReportService reports, CancellationToken ct) => File(await reports.CrewExcelAsync(ct)))
            .WithName("GetCrewRosterExcel").WithSummary("Crew roster with latest vitals (Excel)");

        group.MapGet("alerts.xlsx", async (IReportService reports, CancellationToken ct, AlertStatus? status = null, AlertSeverity? severity = null) =>
                File(await reports.AlertsExcelAsync(status, severity, ct)))
            .WithName("GetAlertsExcel").WithSummary("Health alerts with a live summary sheet (Excel)");

        group.MapGet("astronauts/{astronautId:guid}.pdf", AstronautPdf)
            .WithName("GetAstronautReportPdf").WithSummary("Crew medical report with charts (PDF)")
            .ProducesValidationProblem().ProducesProblem(404);

        group.MapGet("astronauts/{astronautId:guid}/vitals.xlsx", VitalsExcel)
            .WithName("GetVitalsExcel").WithSummary("Raw vitals with threshold highlighting and statistics (Excel)")
            .ProducesValidationProblem().ProducesProblem(404);

        return app;
    }

    private static FileContentHttpResult File(ReportFile file) =>
        TypedResults.File(file.Content, file.ContentType, file.FileName);

    private static async Task<Results<FileContentHttpResult, ValidationProblem, ProblemHttpResult>> AstronautPdf(
        Guid astronautId, IReportService reports, CancellationToken ct, int hours = 24)
    {
        if (InvalidWindow(hours) is { } problem) return problem;
        var result = await reports.AstronautPdfAsync(astronautId, hours, ct);
        return result.IsSuccess ? File(result.Value) : result.Error.ToProblem();
    }

    private static async Task<Results<FileContentHttpResult, ValidationProblem, ProblemHttpResult>> VitalsExcel(
        Guid astronautId, IReportService reports, CancellationToken ct, int hours = 24)
    {
        if (InvalidWindow(hours) is { } problem) return problem;
        var result = await reports.VitalsExcelAsync(astronautId, hours, ct);
        return result.IsSuccess ? File(result.Value) : result.Error.ToProblem();
    }

    private static ValidationProblem? InvalidWindow(int hours) =>
        hours is < 1 or > MaxWindowHours
            ? TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["hours"] = [$"'hours' must be between 1 and {MaxWindowHours}."]
            })
            : null;
}
