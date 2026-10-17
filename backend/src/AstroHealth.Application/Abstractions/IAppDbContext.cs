using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Missions;
using AstroHealth.Domain.Vitals;
using Microsoft.EntityFrameworkCore;

namespace AstroHealth.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<Mission> Missions { get; }
    DbSet<Astronaut> Astronauts { get; }
    DbSet<VitalReading> VitalReadings { get; }
    DbSet<VitalRollup> VitalRollups { get; }
    DbSet<HealthAlert> HealthAlerts { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
