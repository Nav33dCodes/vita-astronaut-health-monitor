using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using AstroHealth.Api.Infrastructure;
using AstroHealth.Api.Realtime;
using AstroHealth.Application.Abstractions;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AstroHealth.Api;

internal static class ApiServiceExtensions
{
    public const string RateLimitPolicy = "per-client";
    private const string CorsPolicy = "frontend";

    public static IServiceCollection AddApi(this IServiceCollection services, IConfiguration configuration)
    {
        services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

        // Validation error keys should match the camelCase JSON property names clients send.
        ValidatorOptions.Global.PropertyNameResolver = (_, member, _) =>
            member is null ? null : JsonNamingPolicy.CamelCase.ConvertName(member.Name);

        services.AddOpenApi(options => options.AddDocumentTransformer((document, _, _) =>
        {
            document.Info.Title = "AstroHealth API";
            document.Info.Version = "v1";
            document.Info.Description = "Crew health monitoring for long-duration space missions.";
            return Task.CompletedTask;
        }));

        services.AddProblemDetails(options => options.CustomizeProblemDetails = ctx =>
        {
            ctx.ProblemDetails.Instance = $"{ctx.HttpContext.Request.Method} {ctx.HttpContext.Request.Path}";
            ctx.ProblemDetails.Extensions["traceId"] = ctx.HttpContext.TraceIdentifier;
        });
        services.AddExceptionHandler<GlobalExceptionHandler>();

        var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        services.AddCors(options => options.AddPolicy(CorsPolicy, policy =>
            // Credentials are required by the SignalR negotiate/WebSocket handshake.
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(RateLimitPolicy, context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 1200, Window = TimeSpan.FromMinutes(1) }));
        });

        services.AddSignalR()
            .AddJsonProtocol(options => options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
        services.AddSingleton<ConnectionTracker>();
        services.Replace(ServiceDescriptor.Singleton<ITelemetryPublisher, SignalRTelemetryPublisher>());

        return services;
    }

    public static WebApplication UseApi(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages();

        if (!app.Environment.IsDevelopment())
        {
            app.UseHsts();
            app.UseHttpsRedirection();
        }

        app.UseCors(CorsPolicy);
        app.UseRateLimiter();
        return app;
    }
}
