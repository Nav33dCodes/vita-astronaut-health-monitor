using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Vitals;

namespace AstroHealth.Tests.Domain;

public class HealthAlertTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 17, 12, 0, 0, TimeSpan.Zero);

    private static HealthAlert NewAlert()
    {
        var reading = new VitalReading(Guid.NewGuid(), Now, 150, 118, 76, 98, 36.8m, 14, 0.2m);
        return HealthAlert.Raise(reading, HealthEvaluator.Evaluate(reading).Single());
    }

    [Fact]
    public void New_alert_is_open()
    {
        Assert.Equal(AlertStatus.Open, NewAlert().Status);
    }

    [Fact]
    public void Acknowledge_moves_open_alert_to_acknowledged()
    {
        var alert = NewAlert();

        var result = alert.Acknowledge(Now);

        Assert.True(result.IsSuccess);
        Assert.Equal(AlertStatus.Acknowledged, alert.Status);
        Assert.Equal(Now, alert.AcknowledgedAtUtc);
    }

    [Fact]
    public void Cannot_acknowledge_twice()
    {
        var alert = NewAlert();
        alert.Acknowledge(Now);

        var result = alert.Acknowledge(Now);

        Assert.True(result.IsFailure);
        Assert.Equal("Alert.InvalidTransition", result.Error.Code);
    }

    [Fact]
    public void Resolving_an_open_alert_also_stamps_acknowledgement()
    {
        var alert = NewAlert();

        alert.Resolve(Now, "Handled");

        Assert.Equal(AlertStatus.Resolved, alert.Status);
        Assert.Equal(Now, alert.AcknowledgedAtUtc);
        Assert.Equal("Handled", alert.ResolutionNote);
    }

    [Fact]
    public void Cannot_resolve_twice()
    {
        var alert = NewAlert();
        alert.Resolve(Now, null);

        Assert.True(alert.Resolve(Now, null).IsFailure);
    }
}
