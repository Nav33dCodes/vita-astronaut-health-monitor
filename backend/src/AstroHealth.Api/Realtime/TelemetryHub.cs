using AstroHealth.Application.Abstractions;
using AstroHealth.Application.Alerts;
using AstroHealth.Application.Vitals;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.AspNetCore.SignalR;

namespace AstroHealth.Api.Realtime;

/// <summary>Methods the server can invoke on connected monitoring clients.</summary>
public interface ITelemetryClient
{
    Task ReadingRecorded(ReadingRecordedEvent @event);
    Task AlertRaised(AlertResponse alert);
    Task AlertUpdated(AlertResponse alert);
    Task AlertEscalated(AlertResponse alert);
}

/// <summary>Real-time telemetry stream for mission-control dashboards.</summary>
public sealed class TelemetryHub(ConnectionTracker connections, TimeProvider clock) : Hub<ITelemetryClient>
{
    public const string Path = "/hubs/telemetry";

    public override Task OnConnectedAsync()
    {
        connections.Increment();
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        connections.Decrement();
        return base.OnDisconnectedAsync(exception);
    }

    /// <summary>Round-trip probe so clients can display link latency.</summary>
    public DateTimeOffset Ping() => clock.GetUtcNow();
}

public sealed class ConnectionTracker
{
    private int _count;

    public int Count => Volatile.Read(ref _count);
    public void Increment() => Interlocked.Increment(ref _count);
    public void Decrement() => Interlocked.Decrement(ref _count);
}

/// <summary>
/// Fans domain events out to every connected client via SignalR. Alert changes also evict the
/// cached dashboard first, so clients refetching in response never read stale counts.
/// </summary>
internal sealed class SignalRTelemetryPublisher(
    IHubContext<TelemetryHub, ITelemetryClient> hub,
    IOutputCacheStore outputCache,
    ILogger<SignalRTelemetryPublisher> logger) : ITelemetryPublisher
{
    public Task ReadingRecordedAsync(ReadingRecordedEvent @event, CancellationToken ct = default) =>
        SafeSend(() => hub.Clients.All.ReadingRecorded(@event), nameof(ITelemetryClient.ReadingRecorded));

    public Task AlertRaisedAsync(AlertResponse alert, CancellationToken ct = default) =>
        SafeSend(() => hub.Clients.All.AlertRaised(alert), nameof(ITelemetryClient.AlertRaised), evictDashboard: true);

    public Task AlertUpdatedAsync(AlertResponse alert, CancellationToken ct = default) =>
        SafeSend(() => hub.Clients.All.AlertUpdated(alert), nameof(ITelemetryClient.AlertUpdated), evictDashboard: true);

    public Task AlertEscalatedAsync(AlertResponse alert, CancellationToken ct = default) =>
        SafeSend(() => hub.Clients.All.AlertEscalated(alert), nameof(ITelemetryClient.AlertEscalated), evictDashboard: true);

    private async Task SafeSend(Func<Task> send, string eventName, bool evictDashboard = false)
    {
        try
        {
            if (evictDashboard)
            {
                await outputCache.EvictByTagAsync(ApiServiceExtensions.DashboardCache, CancellationToken.None);
            }

            await send();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to publish real-time event {Event}", eventName);
        }
    }
}
