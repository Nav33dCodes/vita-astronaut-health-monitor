using System.IO.Compression;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using AstroHealth.Api.Infrastructure;
using AstroHealth.Api.Realtime;
using AstroHealth.Application.Abstractions;
using FluentValidation;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AstroHealth.Api;

internal static class ApiServiceExtensions
{
    public const string RateLimitPolicy = "per-client";

    // Server-side output cache policies (short-lived; evicted on alert changes — see SignalRTelemetryPublisher).
    public const string ReferenceCache = "reference";
    public const string DashboardCache = "dashboard";
    public const string AssessmentsCache = "assessments";
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
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()
                // Lets the browser read the download file name of generated reports.
                .WithExposedHeaders("Content-Disposition")));

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(RateLimitPolicy, context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 1200, Window = TimeSpan.FromMinutes(1) }));
        });

        // JSON compresses ~5-10x — the cheapest win on slow links. Fastest level keeps CPU cost negligible.
        services.AddResponseCompression(options =>
        {
            options.EnableForHttps = true;
            options.Providers.Add<BrotliCompressionProvider>();
            options.Providers.Add<GzipCompressionProvider>();
            options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["application/problem+json"]);
        });
        services.Configure<BrotliCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);
        services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);

        // Shields the database from bursts (many dashboards refreshing at once).
        services.AddOutputCache(options =>
        {
            options.AddPolicy(ReferenceCache, b => b.Expire(TimeSpan.FromHours(1)).Tag(ReferenceCache));
            options.AddPolicy(DashboardCache, b => b.Expire(TimeSpan.FromSeconds(5)).Tag(DashboardCache));
            options.AddPolicy(AssessmentsCache, b => b.Expire(TimeSpan.FromSeconds(15)).SetVaryByQuery("windowMinutes").Tag(AssessmentsCache));
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
        app.UseResponseCompression();

        if (!app.Environment.IsDevelopment())
        {
            app.UseHsts();
            app.UseHttpsRedirection();
        }

        app.UseCors(CorsPolicy);
        app.UseRateLimiter();
        // Outside the output cache so cached responses still get ETags and 304s.
        app.UseMiddleware<ConditionalGetMiddleware>();
        app.UseOutputCache();
        return app;
    }
}
