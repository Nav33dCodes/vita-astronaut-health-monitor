using AstroHealth.Api.Infrastructure;
using AstroHealth.Application.Astronauts;
using AstroHealth.Application.Common;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AstroHealth.Api.Endpoints;

internal static class AstronautEndpoints
{
    public static IEndpointRouteBuilder MapAstronautEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("astronauts").WithTags("Astronauts");

        group.MapGet("", List).WithName("ListAstronauts").WithSummary("Search crew with health status, paged")
            .WithValidation<AstronautQuery>();
        group.MapGet("{id:guid}", Get).WithName("GetAstronaut").WithSummary("Get an astronaut with their latest vitals")
            .ProducesProblem(404);
        group.MapPost("", Create).WithName("CreateAstronaut").WithSummary("Add an astronaut")
            .WithValidation<UpsertAstronautRequest>().ProducesProblem(404);
        group.MapPut("{id:guid}", Update).WithName("UpdateAstronaut").WithSummary("Update an astronaut")
            .WithValidation<UpsertAstronautRequest>().ProducesProblem(404);
        group.MapDelete("{id:guid}", Delete).WithName("DeleteAstronaut").WithSummary("Delete an astronaut and their records")
            .ProducesProblem(404);

        return app;
    }

    private static async Task<Ok<PagedResult<AstronautSummaryResponse>>> List(
        [AsParameters] AstronautQuery query, IAstronautService astronauts, CancellationToken ct) =>
        TypedResults.Ok(await astronauts.ListAsync(query, ct));

    private static async Task<Results<Ok<AstronautDetailResponse>, ProblemHttpResult>> Get(
        Guid id, IAstronautService astronauts, CancellationToken ct)
    {
        var result = await astronauts.GetAsync(id, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }

    private static async Task<Results<CreatedAtRoute<AstronautDetailResponse>, ProblemHttpResult>> Create(
        UpsertAstronautRequest request, IAstronautService astronauts, CancellationToken ct)
    {
        var result = await astronauts.CreateAsync(request, ct);
        return result.IsSuccess
            ? TypedResults.CreatedAtRoute(result.Value, "GetAstronaut", new { id = result.Value.Id })
            : result.Error.ToProblem();
    }

    private static async Task<Results<Ok<AstronautDetailResponse>, ProblemHttpResult>> Update(
        Guid id, UpsertAstronautRequest request, IAstronautService astronauts, CancellationToken ct)
    {
        var result = await astronauts.UpdateAsync(id, request, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> Delete(
        Guid id, IAstronautService astronauts, CancellationToken ct)
    {
        var result = await astronauts.DeleteAsync(id, ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.Error.ToProblem();
    }
}
