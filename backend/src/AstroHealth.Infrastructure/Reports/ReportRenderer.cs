using AstroHealth.Application.Reports;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

namespace AstroHealth.Infrastructure.Reports;

/// <summary>Renders report models with QuestPDF (PDF) and ClosedXML (Excel).</summary>
internal sealed class ReportRenderer : IReportRenderer
{
    private const string Pdf = "application/pdf";
    private const string Xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    static ReportRenderer()
    {
        // QuestPDF Community licence: free for individuals, non-profits and companies under $1M revenue.
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public ReportFile FleetPdf(FleetReport report) =>
        new(new FleetReportDocument(report).GeneratePdf(), Pdf, ReportTheme.FileName("fleet-report", "pdf", report.GeneratedAtUtc));

    public ReportFile AstronautPdf(AstronautReport report) =>
        new(new AstronautReportDocument(report).GeneratePdf(), Pdf,
            ReportTheme.FileName($"{report.Astronaut.LastName}-medical-report", "pdf", report.GeneratedAtUtc));

    public ReportFile CrewExcel(FleetReport report) =>
        new(ExcelReports.Crew(report), Xlsx, ReportTheme.FileName("crew-roster", "xlsx", report.GeneratedAtUtc));

    public ReportFile AlertsExcel(AlertsReport report) =>
        new(ExcelReports.Alerts(report), Xlsx, ReportTheme.FileName("alerts", "xlsx", report.GeneratedAtUtc));

    public ReportFile VitalsExcel(VitalsReport report) =>
        new(ExcelReports.Vitals(report), Xlsx,
            ReportTheme.FileName($"{report.Astronaut.LastName}-vitals-{report.WindowHours}h", "xlsx", report.GeneratedAtUtc));
}
