using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using AstroHealth.Application.Abstractions;
using AstroHealth.Application.Alerts;
using AstroHealth.Application.Astronauts;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Astronauts;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AstroHealth.Tests.Api;

/// <summary>Captures published real-time events instead of sending them over SignalR.</summary>
public sealed class RecordingPublisher : ITelemetryPublisher
{
    public ConcurrentQueue<object> Events { get; } = new();

    public Task ReadingRecordedAsync(ReadingRecordedEvent @event, CancellationToken ct = default) => Add(@event);
    public Task AlertRaisedAsync(AlertResponse alert, CancellationToken ct = default) => Add(("raised", alert));
    public Task AlertUpdatedAsync(AlertResponse alert, CancellationToken ct = default) => Add(("updated", alert));
    public Task AlertEscalatedAsync(AlertResponse alert, CancellationToken ct = default) => Add(("escalated", alert));

    private Task Add(object e)
    {
        Events.Enqueue(e);
        return Task.CompletedTask;
    }
}

public class RealtimeTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly RecordingPublisher _publisher = new();
    private readonly HttpClient _client;

    public RealtimeTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.Replace(ServiceDescriptor.Singleton<ITelemetryPublisher>(_publisher)))).CreateClient();
    }

    private async Task<Guid> CreateAstronautAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/astronauts",
            new UpsertAstronautRequest("Live", "Tester", "ESA", CrewRole.FlightEngineer, new DateOnly(1988, 2, 2), null),
            ApiFactory.Json);
        return (await response.ReadAsAsync<AstronautDetailResponse>()).Id;
    }

    [Fact]
    public async Task Telemetry_hub_accepts_negotiation()
    {
        var response = await _factory.CreateClient().PostAsync("/hubs/telemetry/negotiate?negotiateVersion=1", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Recording_vitals_publishes_reading_and_alert_events()
    {
        var id = await CreateAstronautAsync();

        await _client.PostAsJsonAsync($"/api/v1/astronauts/{id}/vitals",
            new RecordVitalsRequest(150, 118, 76, 98m, 36.8m, 14, 0.2m), ApiFactory.Json);

        var reading = Assert.Single(_publisher.Events.OfType<ReadingRecordedEvent>());
        Assert.Equal("Live Tester", reading.AstronautName);
        var (kind, alert) = Assert.Single(_publisher.Events.OfType<(string, AlertResponse)>());
        Assert.Equal("raised", kind);
        Assert.Equal(AlertSeverity.Critical, alert.Severity);
    }

    [Fact]
    public async Task Acknowledging_an_alert_publishes_update()
    {
        var id = await CreateAstronautAsync();
        var recorded = await (await _client.PostAsJsonAsync($"/api/v1/astronauts/{id}/vitals",
            new RecordVitalsRequest(72, 118, 76, 88m, 36.8m, 14, 0.2m), ApiFactory.Json)).ReadAsAsync<RecordVitalsResponse>();

        await _client.PostAsync($"/api/v1/alerts/{recorded.RaisedAlerts[0].Id}/acknowledge", null);

        Assert.Contains(_publisher.Events.OfType<(string, AlertResponse)>(),
            e => e is ("updated", { Status: AlertStatus.Acknowledged }));
    }

    [Fact]
    public async Task Series_downsamples_readings_into_buckets()
    {
        var id = await CreateAstronautAsync();
        var now = DateTimeOffset.UtcNow;
        // Pairs sit well inside 5-minute buckets so clock skew between test and server can't split them.
        foreach (var minutesAgo in new[] { 52, 51, 12, 11 })
        {
            await _client.PostAsJsonAsync($"/api/v1/astronauts/{id}/vitals",
                new RecordVitalsRequest(70 + minutesAgo % 2 * 10, 118, 76, 98m, 36.8m, 14, 0.2m, now.AddMinutes(-minutesAgo)),
                ApiFactory.Json);
        }

        var series = await _client.GetFromJsonAsync<VitalSeriesResponse>(
            $"/api/v1/astronauts/{id}/vitals/series?hours=1&buckets=12", ApiFactory.Json);

        Assert.Equal(300, series!.BucketSeconds);
        Assert.Equal(4, series.RawSampleCount);
        Assert.Equal(2, series.Points.Count);
        Assert.All(series.Points, p => Assert.Equal(2, p.Samples));
        Assert.All(series.Points, p => Assert.Equal(75m, p.HeartRateBpm));
    }

    [Fact]
    public async Task Series_rejects_out_of_range_parameters()
    {
        var id = await CreateAstronautAsync();

        var response = await _client.GetAsync($"/api/v1/astronauts/{id}/vitals/series?hours=0&buckets=5");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task System_status_reports_realtime_hub()
    {
        var status = await _client.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/v1/system/status");

        Assert.Equal("/hubs/telemetry", status.GetProperty("realtimeHub").GetString());
        Assert.False(status.GetProperty("simulator").GetProperty("enabled").GetBoolean());
    }
}
