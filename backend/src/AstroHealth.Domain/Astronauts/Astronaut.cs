using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Common;
using AstroHealth.Domain.Missions;
using AstroHealth.Domain.Vitals;

namespace AstroHealth.Domain.Astronauts;

public enum CrewRole
{
    Commander,
    Pilot,
    FlightEngineer,
    MissionSpecialist,
    MedicalOfficer,
    PayloadSpecialist
}

public enum HealthStatus
{
    Unknown,
    Nominal,
    Caution,
    Critical
}

public sealed class Astronaut : Entity, IAuditable
{
    private readonly List<VitalReading> _readings = [];
    private readonly List<HealthAlert> _alerts = [];

    private Astronaut() { } // EF Core

    public Astronaut(string firstName, string lastName, string agency, CrewRole role, DateOnly dateOfBirth, Guid? missionId)
    {
        FirstName = firstName;
        LastName = lastName;
        Agency = agency;
        Role = role;
        DateOfBirth = dateOfBirth;
        MissionId = missionId;
    }

    public string FirstName { get; private set; } = null!;
    public string LastName { get; private set; } = null!;
    public string Agency { get; private set; } = null!;
    public CrewRole Role { get; private set; }
    public DateOnly DateOfBirth { get; private set; }

    public Guid? MissionId { get; private set; }
    public Mission? Mission { get; private set; }

    public IReadOnlyCollection<VitalReading> Readings => _readings;
    public IReadOnlyCollection<HealthAlert> Alerts => _alerts;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public void Update(string firstName, string lastName, string agency, CrewRole role, DateOnly dateOfBirth, Guid? missionId)
    {
        FirstName = firstName;
        LastName = lastName;
        Agency = agency;
        Role = role;
        DateOfBirth = dateOfBirth;
        MissionId = missionId;
    }
}

public static class AstronautErrors
{
    public static Error NotFound(Guid id) => Error.NotFound("Astronaut.NotFound", $"Astronaut '{id}' was not found.");
}
