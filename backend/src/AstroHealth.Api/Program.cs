using AstroHealth.Api;
using AstroHealth.Api.Endpoints;
using AstroHealth.Api.Realtime;
using AstroHealth.Application;
using AstroHealth.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration)
    .AddApi(builder.Configuration);

var app = builder.Build();

app.UseApi();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options => options.WithTitle("AstroHealth API"));
}

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });

app.MapApiEndpoints();
app.MapHub<TelemetryHub>(TelemetryHub.Path);

await app.InitialiseDatabaseAsync(seed: app.Configuration.GetValue<bool>("Database:Seed"));

app.Run();

public partial class Program;
