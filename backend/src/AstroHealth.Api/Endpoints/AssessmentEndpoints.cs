using AstroHealth.Api.Infrastructure;
using AstroHealth.Application.Vitals;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AstroHealth.Api.Endpoints;

internal static class AssessmentEndpoints
{
    private const int MinWindowMinutes = 15;
    private const int MaxWindowMinutes = 24 * 60;

    public static IEndpointRouteBuilder MapAssessmentEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("assessments", Fleet)
            .WithTags("Early warning").WithName("GetFleetAssessments")
            .WithSummary("Early-warning score and trend analysis for every astronaut, most at-risk first")
            .ProducesValidationProblem()
            .CacheOutput(ApiServiceExtensions.AssessmentsCache);

        app.MapGet("early-warning/scoring", () => TypedResults.Ok(EarlyWarningScoringResponse.Current))
            .WithTags("Early warning").WithName("GetEarlyWarningScoring")
            .WithSummary("Scoring bands and risk thresholds of the early warning score")
            .CacheOutput(ApiServiceExtensions.ReferenceCache)
            .WithBrowserCache(TimeSpan.FromHours(1));

        app.MapGet("astronauts/{astronautId:guid}/assessment", Single)
            .WithTags("Early warning").WithName("GetAstronautAssessment")
            .WithSummary("Early-warning score breakdown and vital-sign trends for one astronaut")
            .ProducesValidationProblem().ProducesProblem(404);

        return app;
    }

    private static async Task<Results<Ok<IReadOnlyList<HealthAssessmentResponse>>, ValidationProblem>> Fleet(
        IHealthAssessmentService assessments, CancellationToken ct, int windowMinutes = 60) =>
        InvalidWindow(windowMinutes) is { } problem
            ? problem
            : TypedResults.Ok(await assessments.AssessFleetAsync(windowMinutes, ct));

    private static async Task<Results<Ok<HealthAssessmentResponse>, ValidationProblem, ProblemHttpResult>> Single(
        Guid astronautId, IHealthAssessmentService assessments, CancellationToken ct, int windowMinutes = 60)
    {
        if (InvalidWindow(windowMinutes) is { } problem)
        {
            return problem;
        }

        var result = await assessments.AssessAsync(astronautId, windowMinutes, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error.ToProblem();
    }

    private static ValidationProblem? InvalidWindow(int windowMinutes) =>
        windowMinutes is < MinWindowMinutes or > MaxWindowMinutes
            ? TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["windowMinutes"] = [$"'windowMinutes' must be between {MinWindowMinutes} and {MaxWindowMinutes}."]
            })
            : null;
}
