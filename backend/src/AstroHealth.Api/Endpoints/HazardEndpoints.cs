using AstroHealth.Api.Infrastructure;
using AstroHealth.Application.Hazards;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AstroHealth.Api.Endpoints;

/// <summary>
/// The five hazards of human spaceflight (NASA HRP): fleet overview, cabin environment,
/// behavioural health and onboard response checklists.
/// </summary>
internal static class HazardEndpoints
{
    public static IEndpointRouteBuilder MapHazardEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("hazards", async (IHazardService hazards, CancellationToken ct) => TypedResults.Ok(await hazards.GetOverviewAsync(ct)))
            .WithTags("Hazards").WithName("GetHazardOverview")
            .WithSummary("Every active mission and crew member assessed against the five hazards of spaceflight");

        app.MapGet("hazards/playbook", (IHazardService hazards) => TypedResults.Ok(hazards.GetPlaybook()))
            .WithTags("Hazards").WithName("GetCrewPlaybook")
            .WithSummary("Onboard first-response checklists per alert type (for Earth-independent operations)")
            .CacheOutput(ApiServiceExtensions.ReferenceCache)
            .WithBrowserCache(TimeSpan.FromHours(1));

        app.MapGet("habitat/thresholds", (IHabitatService habitat) => TypedResults.Ok(habitat.GetThresholds()))
            .WithTags("Hazards").WithName("GetHabitatThresholds").WithSummary("Warning and critical ranges for the cabin environment")
            .CacheOutput(ApiServiceExtensions.ReferenceCache)
            .WithBrowserCache(TimeSpan.FromHours(1));

        var habitat = app.MapGroup("missions/{missionId:guid}/habitat").WithTags("Hazards");
        habitat.MapGet("", HabitatHistory).WithName("GetHabitatHistory")
            .WithSummary("Cabin environment readings for a mission, oldest first")
            .ProducesValidationProblem().ProducesProblem(404);
        habitat.MapPost("", RecordHabitat).WithName("RecordHabitat")
            .WithSummary("Record a cabin environment reading")
            .WithValidation<RecordHabitatRequest>().ProducesProblem(404);

        var wellness = app.MapGroup("astronauts/{astronautId:guid}/wellness").WithTags("Hazards");
        wellness.MapGet("", Wellness).WithName("GetWellness")
            .WithSummary("Sleep, activity and check-in history with a behavioural-health status")
            .ProducesValidationProblem().ProducesProblem(404);
        wellness.MapPost("check-in", CheckIn).WithName("WellnessCheckIn")
            .WithSummary("Record today's self-reported mood, stress and workload")
            .WithValidation<WellnessCheckInRequest>().ProducesProblem(404);

        return app;
    }

    private static async Task<Results<Ok<IReadOnlyList<HabitatReadingResponse>>, ValidationProblem, ProblemHttpResult>> HabitatHistory(
        Guid missionId, IHabitatService habitat, CancellationToken ct, int minutes = 30)
    {
        if (minutes is < 1 or > 24 * 60)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["minutes"] = ["'minutes' must be between 1 and 1440."] });
        }

        var result = await habitat.GetHistoryAsync(missionId, minutes, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }

    private static async Task<Results<Created<HabitatReadingResponse>, ProblemHttpResult>> RecordHabitat(
        Guid missionId, RecordHabitatRequest request, IHabitatService habitat, CancellationToken ct)
    {
        var result = await habitat.RecordAsync(missionId, request, ct);
        return result.IsSuccess
            ? TypedResults.Created($"/api/v1/missions/{missionId}/habitat", result.Value)
            : result.Error.ToProblem();
    }

    private static async Task<Results<Ok<WellnessResponse>, ValidationProblem, ProblemHttpResult>> Wellness(
        Guid astronautId, IWellnessService wellness, CancellationToken ct, int days = 14)
    {
        if (days is < 1 or > 90)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["days"] = ["'days' must be between 1 and 90."] });
        }

        var result = await wellness.GetAsync(astronautId, days, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }

    private static async Task<Results<Ok<WellnessResponse>, ProblemHttpResult>> CheckIn(
        Guid astronautId, WellnessCheckInRequest request, IWellnessService wellness, CancellationToken ct)
    {
        var result = await wellness.CheckInAsync(astronautId, request, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }
}
