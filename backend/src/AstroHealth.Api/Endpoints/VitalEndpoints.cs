using AstroHealth.Api.Infrastructure;
using AstroHealth.Application.Common;
using AstroHealth.Application.Vitals;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AstroHealth.Api.Endpoints;

internal static class VitalEndpoints
{
    private const int MaxStatsWindowHours = 24 * 30;

    public static IEndpointRouteBuilder MapVitalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("astronauts/{astronautId:guid}/vitals").WithTags("Vitals");

        group.MapGet("", List).WithName("ListVitals").WithSummary("Vitals history, newest first")
            .WithValidation<VitalsQuery>().ProducesProblem(404);
        group.MapPost("", Record).WithName("RecordVitals")
            .WithSummary("Record a vitals reading; returns any health alerts it raised")
            .WithValidation<RecordVitalsRequest>().ProducesProblem(404);
        group.MapGet("stats", Stats).WithName("GetVitalStats").WithSummary("Min/max/average per metric over a time window")
            .ProducesValidationProblem().ProducesProblem(404);
        group.MapGet("series", Series).WithName("GetVitalSeries")
            .WithSummary("Downsampled time series for charts (mean per bucket)")
            .ProducesValidationProblem().ProducesProblem(404);

        app.MapGet("vitals/thresholds", (IVitalService vitals) => TypedResults.Ok(vitals.GetThresholds()))
            .WithTags("Vitals").WithName("GetVitalThresholds").WithSummary("Warning and critical ranges per metric")
            .CacheOutput(ApiServiceExtensions.ReferenceCache)
            .WithBrowserCache(TimeSpan.FromHours(1));

        app.MapGet("telemetry/snapshot", Snapshot)
            .WithTags("Vitals").WithName("GetTelemetrySnapshot")
            .WithSummary("Recent raw readings for every streaming astronaut in one call (live monitor bootstrap)")
            .ProducesValidationProblem();

        return app;
    }

    private static async Task<Results<Ok<PagedResult<VitalReadingResponse>>, ProblemHttpResult>> List(
        Guid astronautId, [AsParameters] VitalsQuery query, IVitalService vitals, CancellationToken ct)
    {
        var result = await vitals.ListAsync(astronautId, query, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }

    private static async Task<Results<Created<RecordVitalsResponse>, ProblemHttpResult>> Record(
        Guid astronautId, RecordVitalsRequest request, IVitalService vitals, CancellationToken ct)
    {
        var result = await vitals.RecordAsync(astronautId, request, ct);
        return result.IsSuccess
            ? TypedResults.Created($"/api/v1/astronauts/{astronautId}/vitals/{result.Value.Reading.Id}", result.Value)
            : result.Error.ToProblem();
    }

    private static async Task<Results<Ok<VitalStatsResponse>, ValidationProblem, ProblemHttpResult>> Stats(
        Guid astronautId, IVitalService vitals, CancellationToken ct, int hours = 24)
    {
        if (hours is < 1 or > MaxStatsWindowHours)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["hours"] = [$"'hours' must be between 1 and {MaxStatsWindowHours}."]
            });
        }

        var result = await vitals.GetStatsAsync(astronautId, hours, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }

    private static async Task<Results<Ok<TelemetrySnapshotResponse>, ValidationProblem>> Snapshot(
        IVitalService vitals, CancellationToken ct, Guid? missionId = null, int minutes = 5, int perAstronaut = 60)
    {
        if (minutes is < 1 or > 60 || perAstronaut is < 1 or > 200)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["query"] = ["'minutes' must be 1–60 and 'perAstronaut' 1–200."]
            });
        }

        return TypedResults.Ok(await vitals.GetSnapshotAsync(minutes, perAstronaut, missionId, ct));
    }

    private static async Task<Results<Ok<VitalSeriesResponse>, ValidationProblem, ProblemHttpResult>> Series(
        Guid astronautId, IVitalService vitals, CancellationToken ct, int hours = 24, int buckets = 240)
    {
        var errors = new Dictionary<string, string[]>();
        if (hours is < 1 or > MaxStatsWindowHours)
        {
            errors["hours"] = [$"'hours' must be between 1 and {MaxStatsWindowHours}."];
        }
        if (buckets is < 10 or > 1000)
        {
            errors["buckets"] = ["'buckets' must be between 10 and 1000."];
        }
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var result = await vitals.GetSeriesAsync(astronautId, hours, buckets, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }
}
