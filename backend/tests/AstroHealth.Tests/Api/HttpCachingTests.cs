using System.Net;
using System.Net.Http.Json;
using AstroHealth.Application.Astronauts;
using AstroHealth.Application.Dashboard;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Astronauts;

namespace AstroHealth.Tests.Api;

public class HttpCachingTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Reference_data_is_browser_cacheable_with_an_etag()
    {
        var response = await _client.GetAsync("/api/v1/vitals/thresholds");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(response.Headers.ETag);
        Assert.True(response.Headers.CacheControl!.Public);
        Assert.Equal(TimeSpan.FromHours(1), response.Headers.CacheControl.MaxAge);
    }

    [Fact]
    public async Task Unchanged_resource_revalidates_to_an_empty_304()
    {
        var first = await _client.GetAsync("/api/v1/missions");
        var etag = first.Headers.ETag!;

        using var revalidate = new HttpRequestMessage(HttpMethod.Get, "/api/v1/missions");
        revalidate.Headers.IfNoneMatch.Add(etag);
        var second = await _client.SendAsync(revalidate);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
        Assert.Empty(await second.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Live_data_must_always_be_revalidated()
    {
        var response = await _client.GetAsync("/api/v1/missions");

        Assert.True(response.Headers.CacheControl!.NoCache);
        Assert.True(response.Headers.CacheControl.Private);
    }

    [Fact]
    public async Task Changed_resource_gets_a_new_etag()
    {
        var before = (await _client.GetAsync("/api/v1/astronauts")).Headers.ETag!;

        await _client.PostAsJsonAsync("/api/v1/astronauts",
            new UpsertAstronautRequest("Etag", "Change", "NASA", CrewRole.Pilot, new DateOnly(1985, 1, 1), null), ApiFactory.Json);

        using var revalidate = new HttpRequestMessage(HttpMethod.Get, "/api/v1/astronauts");
        revalidate.Headers.IfNoneMatch.Add(before);
        var after = await _client.SendAsync(revalidate);

        Assert.Equal(HttpStatusCode.OK, after.StatusCode);
        Assert.NotEqual(before, after.Headers.ETag);
    }

    [Fact]
    public async Task Json_responses_are_compressed_when_the_client_accepts_it()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/vitals/thresholds");
        request.Headers.AcceptEncoding.ParseAdd("br");

        var response = await _client.SendAsync(request);

        Assert.Contains("br", response.Content.Headers.ContentEncoding);
    }

    [Fact]
    public async Task Alert_changes_evict_the_cached_dashboard()
    {
        var astronaut = await (await _client.PostAsJsonAsync("/api/v1/astronauts",
            new UpsertAstronautRequest("Cache", "Evict", "NASA", CrewRole.Pilot, new DateOnly(1985, 1, 1), null),
            ApiFactory.Json)).ReadAsAsync<AstronautDetailResponse>();

        var before = await _client.GetFromJsonAsync<DashboardSummaryResponse>("/api/v1/dashboard/summary", ApiFactory.Json);

        // Critical reading raises an alert -> publisher evicts the 5s dashboard cache.
        await _client.PostAsJsonAsync($"/api/v1/astronauts/{astronaut.Id}/vitals",
            new RecordVitalsRequest(150, 118, 76, 98m, 36.8m, 14, 0.001m), ApiFactory.Json);

        var after = await _client.GetFromJsonAsync<DashboardSummaryResponse>("/api/v1/dashboard/summary", ApiFactory.Json);
        Assert.Equal(before!.OpenAlerts + 1, after!.OpenAlerts);
    }
}
