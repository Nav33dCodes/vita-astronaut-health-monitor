using AstroHealth.Api.Infrastructure;
using AstroHealth.Application.Missions;
using AstroHealth.Domain.Missions;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AstroHealth.Api.Endpoints;

internal static class MissionEndpoints
{
    public static IEndpointRouteBuilder MapMissionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("missions").WithTags("Missions");

        group.MapGet("", List).WithName("ListMissions").WithSummary("List missions, optionally filtered by status");
        group.MapGet("{id:guid}", Get).WithName("GetMission").WithSummary("Get a mission").ProducesProblem(404);
        group.MapPost("", Create).WithName("CreateMission").WithSummary("Create a mission")
            .WithValidation<CreateMissionRequest>().ProducesProblem(409);
        group.MapPut("{id:guid}", Update).WithName("UpdateMission").WithSummary("Update a mission")
            .WithValidation<UpdateMissionRequest>().ProducesProblem(404).ProducesProblem(409);
        group.MapPatch("{id:guid}/status", ChangeStatus).WithName("ChangeMissionStatus").WithSummary("Change a mission's status")
            .WithValidation<ChangeMissionStatusRequest>().ProducesProblem(404).ProducesProblem(409);
        group.MapDelete("{id:guid}", Delete).WithName("DeleteMission").WithSummary("Delete a mission with no crew")
            .ProducesProblem(404).ProducesProblem(409);

        return app;
    }

    private static async Task<Ok<IReadOnlyList<MissionResponse>>> List(
        MissionStatus? status, IMissionService missions, CancellationToken ct) =>
        TypedResults.Ok(await missions.ListAsync(status, ct));

    private static async Task<Results<Ok<MissionResponse>, ProblemHttpResult>> Get(
        Guid id, IMissionService missions, CancellationToken ct)
    {
        var result = await missions.GetAsync(id, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }

    private static async Task<Results<CreatedAtRoute<MissionResponse>, ProblemHttpResult>> Create(
        CreateMissionRequest request, IMissionService missions, CancellationToken ct)
    {
        var result = await missions.CreateAsync(request, ct);
        return result.IsSuccess
            ? TypedResults.CreatedAtRoute(result.Value, "GetMission", new { id = result.Value.Id })
            : result.Error.ToProblem();
    }

    private static async Task<Results<Ok<MissionResponse>, ProblemHttpResult>> Update(
        Guid id, UpdateMissionRequest request, IMissionService missions, CancellationToken ct)
    {
        var result = await missions.UpdateAsync(id, request, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }

    private static async Task<Results<Ok<MissionResponse>, ProblemHttpResult>> ChangeStatus(
        Guid id, ChangeMissionStatusRequest request, IMissionService missions, CancellationToken ct)
    {
        var result = await missions.ChangeStatusAsync(id, request, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> Delete(
        Guid id, IMissionService missions, CancellationToken ct)
    {
        var result = await missions.DeleteAsync(id, ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.Error.ToProblem();
    }
}
