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

    /// <summary>
    /// Radiation dose accumulated on the current mission, mSv. Null until the first dosimeter
    /// reading of the mission, when it is initialised from the mission's elapsed time.
    /// </summary>
    public decimal? MissionDoseMsv { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public void Update(string firstName, string lastName, string agency, CrewRole role, DateOnly dateOfBirth, Guid? missionId)
    {
        FirstName = firstName;
        LastName = lastName;
        Agency = agency;
        Role = role;
        DateOfBirth = dateOfBirth;
        if (missionId != MissionId)
        {
            MissionDoseMsv = null; // a new mission starts a new dose record
        }

        MissionId = missionId;
    }

    /// <summary>Adds a dosimeter increment, starting the record from an estimate if needed.</summary>
    public void AccrueDose(decimal doseMsv, Func<decimal> initialEstimate)
    {
        MissionDoseMsv = (MissionDoseMsv ?? initialEstimate()) + Math.Max(0, doseMsv);
    }
}

public static class AstronautErrors
{
    public static Error NotFound(Guid id) => Error.NotFound("Astronaut.NotFound", $"Astronaut '{id}' was not found.");
}
