using AstroHealth.Application.Alerts;
using AstroHealth.Application.Vitals;

namespace AstroHealth.Application.Abstractions;

/// <summary>
/// Pushes domain events to connected real-time clients.
/// Implementations must never throw: a failed push must not fail the request that caused it.
/// </summary>
public interface ITelemetryPublisher
{
    Task ReadingRecordedAsync(ReadingRecordedEvent @event, CancellationToken ct = default);
    Task AlertRaisedAsync(AlertResponse alert, CancellationToken ct = default);
    Task AlertUpdatedAsync(AlertResponse alert, CancellationToken ct = default);
    Task AlertEscalatedAsync(AlertResponse alert, CancellationToken ct = default);
}

/// <summary>Default no-op publisher, used when no real-time transport is configured.</summary>
internal sealed class NullTelemetryPublisher : ITelemetryPublisher
{
    public Task ReadingRecordedAsync(ReadingRecordedEvent @event, CancellationToken ct = default) => Task.CompletedTask;
    public Task AlertRaisedAsync(AlertResponse alert, CancellationToken ct = default) => Task.CompletedTask;
    public Task AlertUpdatedAsync(AlertResponse alert, CancellationToken ct = default) => Task.CompletedTask;
    public Task AlertEscalatedAsync(AlertResponse alert, CancellationToken ct = default) => Task.CompletedTask;
}
