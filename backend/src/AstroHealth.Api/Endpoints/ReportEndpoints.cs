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

        group.MapGet("fleet.pdf", async (HttpRequest request, IReportService reports, CancellationToken ct) => File(request, await reports.FleetPdfAsync(ct)))
            .WithName("GetFleetReportPdf").WithSummary("Fleet health report (PDF)");

        // Extension-less aliases used by the app: download-manager extensions intercept any request
        // whose path ends in ".pdf", which breaks the in-page fetch (see File below).
        group.MapGet("fleet", async (HttpRequest request, IReportService reports, CancellationToken ct) => File(request, await reports.FleetPdfAsync(ct)))
            .ExcludeFromDescription();
        group.MapGet("astronauts/{astronautId:guid}", AstronautPdf).ExcludeFromDescription();

        group.MapGet("crew.xlsx", async (HttpRequest request, IReportService reports, CancellationToken ct) => File(request, await reports.CrewExcelAsync(ct)))
            .WithName("GetCrewRosterExcel").WithSummary("Crew roster with latest vitals (Excel)");

        group.MapGet("alerts.xlsx", async (HttpRequest request, IReportService reports, CancellationToken ct, AlertStatus? status = null, AlertSeverity? severity = null) =>
                File(request, await reports.AlertsExcelAsync(status, severity, ct)))
            .WithName("GetAlertsExcel").WithSummary("Health alerts with a live summary sheet (Excel)");

        group.MapGet("astronauts/{astronautId:guid}.pdf", AstronautPdf)
            .WithName("GetAstronautReportPdf").WithSummary("Crew medical report with charts (PDF)")
            .ProducesValidationProblem().ProducesProblem(404);

        group.MapGet("astronauts/{astronautId:guid}/vitals.xlsx", VitalsExcel)
            .WithName("GetVitalsExcel").WithSummary("Raw vitals with threshold highlighting and statistics (Excel)")
            .ProducesValidationProblem().ProducesProblem(404);

        return app;
    }

    /// <summary>
    /// The app downloads reports with fetch and asks for <c>application/octet-stream</c>: browser
    /// download-manager extensions hijack <c>application/pdf</c> responses mid-request (the file still
    /// downloads, but the page sees "Failed to fetch"). A generic binary type is left alone; the client
    /// restores the real type and file name. Direct links and API clients keep the specific media type.
    /// </summary>
    private static FileContentHttpResult File(HttpRequest request, ReportFile file)
    {
        var wantsBinary = request.Headers.Accept.ToString().StartsWith("application/octet-stream", StringComparison.OrdinalIgnoreCase);
        if (!wantsBinary) return TypedResults.File(file.Content, file.ContentType, file.FileName);

        // No attachment disposition either: extensions also key on the ".pdf" file name.
        request.HttpContext.Response.Headers["X-Report-File"] = Uri.EscapeDataString(file.FileName);
        return TypedResults.File(file.Content, "application/octet-stream");
    }

    private static async Task<Results<FileContentHttpResult, ValidationProblem, ProblemHttpResult>> AstronautPdf(
        Guid astronautId, HttpRequest request, IReportService reports, CancellationToken ct, int hours = 24)
    {
        if (InvalidWindow(hours) is { } problem) return problem;
        var result = await reports.AstronautPdfAsync(astronautId, hours, ct);
        return result.IsSuccess ? File(request, result.Value) : result.Error.ToProblem();
    }

    private static async Task<Results<FileContentHttpResult, ValidationProblem, ProblemHttpResult>> VitalsExcel(
        Guid astronautId, HttpRequest request, IReportService reports, CancellationToken ct, int hours = 24)
    {
        if (InvalidWindow(hours) is { } problem) return problem;
        var result = await reports.VitalsExcelAsync(astronautId, hours, ct);
        return result.IsSuccess ? File(request, result.Value) : result.Error.ToProblem();
    }

    private static ValidationProblem? InvalidWindow(int hours) =>
        hours is < 1 or > MaxWindowHours
            ? TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["hours"] = [$"'hours' must be between 1 and {MaxWindowHours}."]
            })
            : null;
}
