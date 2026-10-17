using AstroHealth.Api.Infrastructure;
using AstroHealth.Application.Alerts;
using AstroHealth.Application.Common;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AstroHealth.Api.Endpoints;

internal static class AlertEndpoints
{
    public static IEndpointRouteBuilder MapAlertEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("alerts").WithTags("Alerts");

        group.MapGet("", List).WithName("ListAlerts").WithSummary("List health alerts, most urgent first")
            .WithValidation<AlertQuery>();
        group.MapPost("{id:guid}/acknowledge", Acknowledge).WithName("AcknowledgeAlert")
            .WithSummary("Acknowledge an open alert").ProducesProblem(404).ProducesProblem(409);
        group.MapPost("{id:guid}/resolve", Resolve).WithName("ResolveAlert")
            .WithSummary("Resolve an alert with an optional note")
            .WithValidation<ResolveAlertRequest>().ProducesProblem(404).ProducesProblem(409);

        return app;
    }

    private static async Task<Ok<PagedResult<AlertResponse>>> List(
        [AsParameters] AlertQuery query, IAlertService alerts, CancellationToken ct) =>
        TypedResults.Ok(await alerts.ListAsync(query, ct));

    private static async Task<Results<Ok<AlertResponse>, ProblemHttpResult>> Acknowledge(
        Guid id, IAlertService alerts, CancellationToken ct)
    {
        var result = await alerts.AcknowledgeAsync(id, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }

    private static async Task<Results<Ok<AlertResponse>, ProblemHttpResult>> Resolve(
        Guid id, ResolveAlertRequest request, IAlertService alerts, CancellationToken ct)
    {
        var result = await alerts.ResolveAsync(id, request, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }
}
