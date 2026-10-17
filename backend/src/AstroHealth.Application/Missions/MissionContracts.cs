using AstroHealth.Domain.Missions;

namespace AstroHealth.Application.Missions;

public sealed record MissionResponse(
    Guid Id,
    string Name,
    string? Description,
    MissionDestination Destination,
    MissionStatus Status,
    DateOnly LaunchDate,
    DateOnly? EndDate,
    int CrewCount);

public sealed record CreateMissionRequest(
    string Name,
    MissionDestination Destination,
    DateOnly LaunchDate,
    string? Description);

public sealed record UpdateMissionRequest(
    string Name,
    MissionDestination Destination,
    DateOnly LaunchDate,
    DateOnly? EndDate,
    string? Description);

public sealed record ChangeMissionStatusRequest(MissionStatus Status);
