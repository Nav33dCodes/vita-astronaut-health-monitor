using System.Linq.Expressions;
using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Astronauts;

namespace AstroHealth.Application.Astronauts;

/// <summary>
/// An astronaut's health status is derived from their unresolved alerts:
/// any critical => Critical, any warning => Caution, readings but no alerts => Nominal, no readings => Unknown.
/// The expressions mirror <see cref="From"/> so filtering can run in the database.
/// </summary>
internal static class HealthStatusRules
{
    public static HealthStatus From(int openCritical, int openWarning, bool hasReadings) =>
        openCritical > 0 ? HealthStatus.Critical
        : openWarning > 0 ? HealthStatus.Caution
        : hasReadings ? HealthStatus.Nominal
        : HealthStatus.Unknown;

    public static readonly Expression<Func<Astronaut, bool>> IsCritical = a =>
        a.Alerts.Any(x => x.Status != AlertStatus.Resolved && x.Severity == AlertSeverity.Critical);

    public static readonly Expression<Func<Astronaut, bool>> IsCaution = a =>
        !a.Alerts.Any(x => x.Status != AlertStatus.Resolved && x.Severity == AlertSeverity.Critical) &&
        a.Alerts.Any(x => x.Status != AlertStatus.Resolved && x.Severity == AlertSeverity.Warning);

    public static readonly Expression<Func<Astronaut, bool>> IsNominal = a =>
        !a.Alerts.Any(x => x.Status != AlertStatus.Resolved) && a.Readings.Any();

    public static readonly Expression<Func<Astronaut, bool>> IsUnknown = a =>
        !a.Alerts.Any(x => x.Status != AlertStatus.Resolved) && !a.Readings.Any();
}
