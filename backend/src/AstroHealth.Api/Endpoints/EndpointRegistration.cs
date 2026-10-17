using AstroHealth.Application.Dashboard;

namespace AstroHealth.Api.Endpoints;

internal static class EndpointRegistration
{
    public static IEndpointRouteBuilder MapApiEndpoints(this IEndpointRouteBuilder app)
    {
        var v1 = app.MapGroup("api/v1").RequireRateLimiting(ApiServiceExtensions.RateLimitPolicy);

        v1.MapGet("dashboard/summary", async (IDashboardService dashboard, CancellationToken ct) =>
                TypedResults.Ok(await dashboard.GetSummaryAsync(ct)))
            .WithTags("Dashboard").WithName("GetDashboardSummary").WithSummary("Fleet-wide crew health overview");

        v1.MapMissionEndpoints()
            .MapAstronautEndpoints()
            .MapVitalEndpoints()
            .MapAlertEndpoints()
            .MapAssessmentEndpoints()
            .MapSystemEndpoints();

        return app;
    }
}
