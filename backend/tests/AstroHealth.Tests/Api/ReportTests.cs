using System.Net;
using System.Net.Http.Json;
using AstroHealth.Application.Astronauts;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Astronauts;
using ClosedXML.Excel;

namespace AstroHealth.Tests.Api;

public class ReportTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private async Task<Guid> AstronautWithReadingsAsync()
    {
        var astronaut = await (await _client.PostAsJsonAsync("/api/v1/astronauts",
            new UpsertAstronautRequest("Report", "Subject", "ESA", CrewRole.MedicalOfficer, new DateOnly(1984, 4, 4), null),
            ApiFactory.Json)).ReadAsAsync<AstronautDetailResponse>();

        var now = DateTimeOffset.UtcNow;
        foreach (var (minutesAgo, heartRate) in new[] { (90, 72), (60, 80), (30, 118), (5, 150) })
        {
            await _client.PostAsJsonAsync($"/api/v1/astronauts/{astronaut.Id}/vitals",
                new RecordVitalsRequest(heartRate, 120, 78, 97.5m, 36.9m, 15, 0.0021m, now.AddMinutes(-minutesAgo)), ApiFactory.Json);
        }
        return astronaut.Id;
    }

    private static async Task<(byte[] Bytes, string? FileName)> Download(HttpResponseMessage response, string contentType)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(contentType, response.Content.Headers.ContentType?.MediaType);
        return (await response.Content.ReadAsByteArrayAsync(), response.Content.Headers.ContentDisposition?.FileNameStar
            ?? response.Content.Headers.ContentDisposition?.FileName);
    }

    private const string Xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    [Fact]
    public async Task Fleet_report_is_a_valid_pdf()
    {
        await AstronautWithReadingsAsync();

        var (bytes, name) = await Download(await _client.GetAsync("/api/v1/reports/fleet.pdf"), "application/pdf");

        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
        Assert.StartsWith("vita-fleet-report-", name);
        Assert.EndsWith(".pdf", name);
    }

    [Fact]
    public async Task Astronaut_report_is_a_valid_pdf_named_after_the_astronaut()
    {
        var id = await AstronautWithReadingsAsync();

        var (bytes, name) = await Download(await _client.GetAsync($"/api/v1/reports/astronauts/{id}.pdf?hours=24"), "application/pdf");

        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
        Assert.StartsWith("vita-subject-medical-report-", name);
    }

    [Fact]
    public async Task Vitals_workbook_has_statistics_formulas_and_threshold_highlighting()
    {
        var id = await AstronautWithReadingsAsync();

        var (bytes, name) = await Download(await _client.GetAsync($"/api/v1/reports/astronauts/{id}/vitals.xlsx?hours=24"), Xlsx);
        using var workbook = new XLWorkbook(new MemoryStream(bytes));

        Assert.EndsWith(".xlsx", name);
        Assert.Equal(["Statistics", "Readings", "Thresholds"], workbook.Worksheets.Select(w => w.Name));

        var readings = workbook.Worksheet("Readings");
        var table = readings.Table("Readings");
        Assert.Equal(4, table.DataRange.RowCount());
        Assert.NotEmpty(readings.ConditionalFormats);

        var stats = workbook.Worksheet("Statistics");
        Assert.Equal("MAX(Readings[Heart rate (bpm)])", stats.Cell(5, 4).FormulaA1);
    }

    [Fact]
    public async Task Alerts_workbook_summarises_with_live_formulas()
    {
        await AstronautWithReadingsAsync(); // the 150 bpm reading raises a critical alert

        var (bytes, _) = await Download(await _client.GetAsync("/api/v1/reports/alerts.xlsx?status=Open"), Xlsx);
        using var workbook = new XLWorkbook(new MemoryStream(bytes));

        Assert.Equal(["Summary", "Alerts"], workbook.Worksheets.Select(w => w.Name));
        Assert.True(workbook.Worksheet("Alerts").Table("Alerts").DataRange.RowCount() >= 1);
        Assert.Contains("COUNTIFS(Alerts[Severity]", workbook.Worksheet("Summary").Cell(5, 2).FormulaA1);
    }

    [Fact]
    public async Task Crew_workbook_lists_every_astronaut()
    {
        await AstronautWithReadingsAsync();

        var (bytes, _) = await Download(await _client.GetAsync("/api/v1/reports/crew.xlsx"), Xlsx);
        using var workbook = new XLWorkbook(new MemoryStream(bytes));

        var crew = workbook.Worksheet("Crew").Table("Crew");
        // Other tests in this class create the same astronaut; each one's latest reading is 150 bpm.
        var rows = crew.DataRange.Rows().Where(r => r.Cell(1).GetString() == "Report Subject").ToList();
        Assert.NotEmpty(rows);
        Assert.All(rows, row => Assert.Equal(150, row.Cell(9).GetDouble())); // most recent, not oldest
    }

    [Fact]
    public async Task Report_for_unknown_astronaut_is_404_and_window_is_validated()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/v1/reports/astronauts/{Guid.NewGuid()}.pdf")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync($"/api/v1/reports/astronauts/{Guid.NewGuid()}.pdf?hours=999")).StatusCode);
    }
}
