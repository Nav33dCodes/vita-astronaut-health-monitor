using AstroHealth.Application.Alerts;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AstroHealth.Infrastructure.Maintenance;

/// <summary>Periodically escalates alerts that nobody has acknowledged in time.</summary>
internal sealed class AlertEscalationWorker(
    IServiceScopeFactory scopes,
    IOptions<EscalationPolicy> policy,
    TimeProvider clock,
    ILogger<AlertEscalationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = policy.Value;
        if (!settings.Enabled)
        {
            logger.LogInformation("Alert escalation is disabled");
            return;
        }

        logger.LogInformation(
            "Alert escalation active: critical after {Critical} min, warning after {Warning} min, +1 level every {Repeat} min",
            settings.CriticalAckMinutes, settings.WarningAckMinutes, settings.RepeatMinutes);

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(settings.CheckIntervalSeconds), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<IAlertEscalationService>().EscalateDueAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Alert escalation pass failed");
            }
        }
    }
}
