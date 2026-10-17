using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AstroHealth.Application.Alerts;
using AstroHealth.Application.Astronauts;
using AstroHealth.Application.Common;
using AstroHealth.Application.Dashboard;
using AstroHealth.Application.Missions;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Missions;

namespace AstroHealth.Tests.Api;

public class CrewHealthFlowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private static RecordVitalsRequest Vitals(int heartRate = 72, decimal spo2 = 98m) =>
        new(heartRate, 118, 76, spo2, 36.8m, 14, 0.2m);

    private async Task<AstronautDetailResponse> CreateAstronautAsync()
    {
        var missionResponse = await _client.PostAsJsonAsync("/api/v1/missions",
            new CreateMissionRequest($"Mission {Guid.NewGuid():N}", MissionDestination.Lunar, new DateOnly(2026, 1, 1), null),
            ApiFactory.Json);
        var mission = await missionResponse.ReadAsAsync<MissionResponse>();

        var response = await _client.PostAsJsonAsync("/api/v1/astronauts",
            new UpsertAstronautRequest("Test", "Pilot", "NASA", CrewRole.Pilot, new DateOnly(1985, 5, 5), mission.Id),
            ApiFactory.Json);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.ReadAsAsync<AstronautDetailResponse>();
    }

    [Fact]
    public async Task New_astronaut_has_unknown_health_until_first_reading()
    {
        var astronaut = await CreateAstronautAsync();
        Assert.Equal(HealthStatus.Unknown, astronaut.HealthStatus);

        await _client.PostAsJsonAsync($"/api/v1/astronauts/{astronaut.Id}/vitals", Vitals(), ApiFactory.Json);

        var updated = await _client.GetFromJsonAsync<AstronautDetailResponse>($"/api/v1/astronauts/{astronaut.Id}", ApiFactory.Json);
        Assert.Equal(HealthStatus.Nominal, updated!.HealthStatus);
        Assert.NotNull(updated.LatestReading);
    }

    [Fact]
    public async Task Abnormal_reading_raises_alert_and_repeat_is_deduplicated_until_escalation()
    {
        var astronaut = await CreateAstronautAsync();
        var url = $"/api/v1/astronauts/{astronaut.Id}/vitals";

        var first = await (await _client.PostAsJsonAsync(url, Vitals(heartRate: 120), ApiFactory.Json)).ReadAsAsync<RecordVitalsResponse>();
        var repeat = await (await _client.PostAsJsonAsync(url, Vitals(heartRate: 125), ApiFactory.Json)).ReadAsAsync<RecordVitalsResponse>();
        var escalated = await (await _client.PostAsJsonAsync(url, Vitals(heartRate: 150), ApiFactory.Json)).ReadAsAsync<RecordVitalsResponse>();

        Assert.Equal(AlertSeverity.Warning, Assert.Single(first.RaisedAlerts).Severity);
        Assert.Empty(repeat.RaisedAlerts);
        Assert.Equal(AlertSeverity.Critical, Assert.Single(escalated.RaisedAlerts).Severity);

        var detail = await _client.GetFromJsonAsync<AstronautDetailResponse>($"/api/v1/astronauts/{astronaut.Id}", ApiFactory.Json);
        Assert.Equal(HealthStatus.Critical, detail!.HealthStatus);
    }

    [Fact]
    public async Task Resolving_alerts_returns_astronaut_to_nominal()
    {
        var astronaut = await CreateAstronautAsync();
        var recorded = await (await _client.PostAsJsonAsync(
            $"/api/v1/astronauts/{astronaut.Id}/vitals", Vitals(spo2: 88m), ApiFactory.Json)).ReadAsAsync<RecordVitalsResponse>();
        var alert = Assert.Single(recorded.RaisedAlerts);

        var ack = await _client.PostAsync($"/api/v1/alerts/{alert.Id}/acknowledge", null);
        var ackAgain = await _client.PostAsync($"/api/v1/alerts/{alert.Id}/acknowledge", null);
        var resolve = await _client.PostAsJsonAsync($"/api/v1/alerts/{alert.Id}/resolve", new ResolveAlertRequest("O2 restored"), ApiFactory.Json);

        Assert.Equal(HttpStatusCode.OK, ack.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, ackAgain.StatusCode);
        Assert.Equal(AlertStatus.Resolved, (await resolve.ReadAsAsync<AlertResponse>()).Status);

        var detail = await _client.GetFromJsonAsync<AstronautDetailResponse>($"/api/v1/astronauts/{astronaut.Id}", ApiFactory.Json);
        Assert.Equal(HealthStatus.Nominal, detail!.HealthStatus);
    }

    [Fact]
    public async Task Invalid_vitals_return_validation_problem_with_camel_case_keys()
    {
        var astronaut = await CreateAstronautAsync();

        var response = await _client.PostAsJsonAsync(
            $"/api/v1/astronauts/{astronaut.Id}/vitals", Vitals(heartRate: 500), ApiFactory.Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(problem.GetProperty("errors").TryGetProperty("heartRateBpm", out _));
    }

    [Fact]
    public async Task Unknown_astronaut_returns_not_found_problem()
    {
        var response = await _client.GetAsync($"/api/v1/astronauts/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Astronaut_list_filters_by_health_status()
    {
        var critical = await CreateAstronautAsync();
        await _client.PostAsJsonAsync($"/api/v1/astronauts/{critical.Id}/vitals", Vitals(heartRate: 150), ApiFactory.Json);

        var page = await _client.GetFromJsonAsync<PagedResult<AstronautSummaryResponse>>(
            "/api/v1/astronauts?status=Critical&pageSize=100", ApiFactory.Json);

        Assert.Contains(page!.Items, a => a.Id == critical.Id);
        Assert.All(page.Items, a => Assert.Equal(HealthStatus.Critical, a.HealthStatus));
    }

    [Fact]
    public async Task Dashboard_summary_counts_crew()
    {
        await CreateAstronautAsync();

        var summary = await _client.GetFromJsonAsync<DashboardSummaryResponse>("/api/v1/dashboard/summary", ApiFactory.Json);

        Assert.True(summary!.TotalCrew >= 1);
    }
}
