using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Common;

namespace AstroHealth.Domain.Missions;

public enum MissionStatus
{
    Planned,
    Active,
    Completed,
    Aborted
}

public enum MissionDestination
{
    LowEarthOrbit,
    Lunar,
    Mars,
    DeepSpace
}

public sealed class Mission : Entity, IAuditable
{
    private readonly List<Astronaut> _crew = [];

    private Mission() { } // EF Core

    public Mission(string name, MissionDestination destination, DateOnly launchDate, string? description = null)
    {
        Name = name;
        Destination = destination;
        LaunchDate = launchDate;
        Description = description;
        Status = MissionStatus.Planned;
    }

    public string Name { get; private set; } = null!;
    public string? Description { get; private set; }
    public MissionDestination Destination { get; private set; }
    public MissionStatus Status { get; private set; }
    public DateOnly LaunchDate { get; private set; }
    public DateOnly? EndDate { get; private set; }
    public IReadOnlyCollection<Astronaut> Crew => _crew;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public void Update(string name, MissionDestination destination, DateOnly launchDate, DateOnly? endDate, string? description)
    {
        Name = name;
        Destination = destination;
        LaunchDate = launchDate;
        EndDate = endDate;
        Description = description;
    }

    public Result ChangeStatus(MissionStatus newStatus)
    {
        if (Status is MissionStatus.Completed or MissionStatus.Aborted && newStatus != Status)
        {
            return MissionErrors.AlreadyClosed(Id);
        }

        Status = newStatus;
        return Result.Success();
    }
}

public static class MissionErrors
{
    public static Error NotFound(Guid id) => Error.NotFound("Mission.NotFound", $"Mission '{id}' was not found.");
    public static Error NameTaken(string name) => Error.Conflict("Mission.NameTaken", $"A mission named '{name}' already exists.");
    public static Error AlreadyClosed(Guid id) => Error.Conflict("Mission.Closed", $"Mission '{id}' is closed and its status can no longer change.");
    public static Error HasCrew(Guid id) => Error.Conflict("Mission.HasCrew", $"Mission '{id}' still has crew assigned. Reassign them first.");
}
