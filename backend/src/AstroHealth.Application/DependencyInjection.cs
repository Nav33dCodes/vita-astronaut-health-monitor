using AstroHealth.Application.Abstractions;
using AstroHealth.Application.Alerts;
using AstroHealth.Application.Astronauts;
using AstroHealth.Application.Dashboard;
using AstroHealth.Application.Missions;
using AstroHealth.Application.Vitals;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AstroHealth.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<ITelemetryPublisher, NullTelemetryPublisher>();
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly, includeInternalTypes: true);

        services.AddScoped<IMissionService, MissionService>();
        services.AddScoped<IAstronautService, AstronautService>();
        services.AddScoped<IVitalService, VitalService>();
        services.AddScoped<IAlertService, AlertService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IAlertEscalationService, AlertEscalationService>();
        services.AddScoped<IHealthAssessmentService, HealthAssessmentService>();

        return services;
    }
}
