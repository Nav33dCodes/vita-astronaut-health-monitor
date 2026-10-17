using System.Net;
using System.Net.Http.Json;
using AstroHealth.Application.Alerts;
using AstroHealth.Application.Astronauts;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Vitals;
using Microsoft.Extensions.DependencyInjection;

namespace AstroHealth.Tests.Api;

public class SmartMonitoringTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private async Task<Guid> CreateAstronautAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/astronauts",
            new UpsertAstronautRequest("Smart", "Monitor", "NASA", CrewRole.Commander, new DateOnly(1982, 3, 3), null),
            ApiFactory.Json);
        return (await response.ReadAsAsync<AstronautDetailResponse>()).Id;
    }

    private Task<HttpResponseMessage> Record(Guid id, int heartRate, DateTimeOffset? at = null, decimal spo2 = 98m) =>
        _client.PostAsJsonAsync($"/api/v1/astronauts/{id}/vitals",
            new RecordVitalsRequest(heartRate, 120, 76, spo2, 36.8m, 14, 0.001m, at), ApiFactory.Json);

    [Fact]
    public async Task Readings_carry_an_early_warning_score()
    {
        var id = await CreateAstronautAsync();

        var recorded = await (await Record(id, 135, spo2: 92m)).ReadAsAsync<RecordVitalsResponse>();

        Assert.Equal(5, recorded.Reading.EarlyWarningScore); // HR 3 + SpO2 2
        Assert.Equal(EarlyWarningRisk.Medium, recorded.Reading.EarlyWarningRisk);
    }

    [Fact]
    public async Task Unacknowledged_critical_alert_escalates_and_shows_on_dashboard()
    {
        var id = await CreateAstronautAsync();
        await Record(id, 150, DateTimeOffset.UtcNow.AddMinutes(-8)); // critical HR, raised 8 minutes ago

        await using var scope = factory.Services.CreateAsyncScope();
        var escalated = await scope.ServiceProvider.GetRequiredService<IAlertEscalationService>().EscalateDueAsync(CancellationToken.None);

        var alert = Assert.Single(escalated, a => a.AstronautId == id);
        Assert.Equal(2, alert.EscalationLevel); // 2 min ack window + one 5 min repeat

        var page = await _client.GetFromJsonAsync<Application.Common.PagedResult<AlertResponse>>(
            "/api/v1/alerts?escalated=true&pageSize=100", ApiFactory.Json);
        Assert.Contains(page!.Items, a => a.Id == alert.Id);

        // Running again without time passing changes nothing.
        var again = await scope.ServiceProvider.GetRequiredService<IAlertEscalationService>().EscalateDueAsync(CancellationToken.None);
        Assert.DoesNotContain(again, a => a.Id == alert.Id);
    }

    [Fact]
    public async Task Assessment_reports_score_and_detects_a_rising_trend()
    {
        var id = await CreateAstronautAsync();
        var start = DateTimeOffset.UtcNow.AddMinutes(-50);
        for (var minute = 0; minute <= 48; minute += 2)
        {
            await Record(id, 70 + minute / 2, start.AddMinutes(minute)); // +30 bpm/h
        }

        var assessment = await _client.GetFromJsonAsync<HealthAssessmentResponse>(
            $"/api/v1/astronauts/{id}/assessment?windowMinutes=60", ApiFactory.Json);

        Assert.NotNull(assessment!.Score);
        Assert.Equal(5, assessment.Components.Count);
        var trend = Assert.Single(assessment.Trends);
        Assert.Equal(VitalMetric.HeartRate, trend.Metric);
        Assert.Equal(TrendDirection.Rising, trend.Direction);

        var fleet = await _client.GetFromJsonAsync<List<HealthAssessmentResponse>>("/api/v1/assessments", ApiFactory.Json);
        Assert.Contains(fleet!, a => a.AstronautId == id);
    }

    [Fact]
    public async Task Assessment_window_is_validated()
    {
        var response = await _client.GetAsync("/api/v1/assessments?windowMinutes=5");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
