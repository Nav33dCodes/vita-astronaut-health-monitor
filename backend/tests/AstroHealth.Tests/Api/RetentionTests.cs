using System.Net.Http.Json;
using AstroHealth.Application.Astronauts;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Infrastructure.Maintenance;
using AstroHealth.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace AstroHealth.Tests.Api;

public class RetentionTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Old_readings_are_rolled_up_deleted_and_still_charted()
    {
        var astronaut = await (await _client.PostAsJsonAsync("/api/v1/astronauts",
            new UpsertAstronautRequest("Old", "Data", "NASA", CrewRole.Pilot, new DateOnly(1980, 1, 1), null),
            ApiFactory.Json)).ReadAsAsync<AstronautDetailResponse>();

        var tenDaysAgo = DateTimeOffset.UtcNow.AddDays(-10);
        var oldHour = new DateTimeOffset(tenDaysAgo.Year, tenDaysAgo.Month, tenDaysAgo.Day, tenDaysAgo.Hour, 0, 0, TimeSpan.Zero);

        // Two old readings in the same hour (one abnormal, so an alert references it) + one fresh reading.
        await Record(astronaut.Id, 60, oldHour.AddMinutes(10));
        await Record(astronaut.Id, 150, oldHour.AddMinutes(20));
        await Record(astronaut.Id, 70, null);

        var retention = factory.Services.GetServices<IHostedService>().OfType<TelemetryRetentionService>().Single();
        await retention.RunOnceAsync(new RetentionOptions { RawRetentionDays = 7 }, CancellationToken.None);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var rawLeft = await db.VitalReadings.CountAsync(r => r.AstronautId == astronaut.Id);
        var rollup = await db.VitalRollups.SingleAsync(r => r.AstronautId == astronaut.Id);
        var alert = await db.HealthAlerts.SingleAsync(a => a.AstronautId == astronaut.Id);

        Assert.Equal(1, rawLeft);
        Assert.Equal(2, rollup.Samples);
        Assert.Equal(105m, rollup.AvgHeartRateBpm);
        Assert.Null(alert.VitalReadingId); // alert survives, link to the deleted raw reading is cleared

        var series = await _client.GetFromJsonAsync<VitalSeriesResponse>(
            $"/api/v1/astronauts/{astronaut.Id}/vitals/series?hours=720&buckets=720", ApiFactory.Json);
        Assert.Equal(3, series!.RawSampleCount);
        Assert.Contains(series.Points, p => p.Samples == 2 && p.HeartRateBpm == 105m);
    }

    private Task<HttpResponseMessage> Record(Guid id, int heartRate, DateTimeOffset? at) =>
        _client.PostAsJsonAsync($"/api/v1/astronauts/{id}/vitals",
            new RecordVitalsRequest(heartRate, 118, 76, 98m, 36.8m, 14, 0.0012m, at), ApiFactory.Json);
}
