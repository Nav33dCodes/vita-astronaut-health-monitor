using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Astronauts;

namespace AstroHealth.Application.Astronauts;

public sealed record AstronautSummaryResponse(
    Guid Id,
    string FirstName,
    string LastName,
    string Agency,
    CrewRole Role,
    Guid? MissionId,
    string? MissionName,
    HealthStatus HealthStatus,
    int OpenAlerts,
    DateTimeOffset? LastReadingAtUtc);

public sealed record AstronautDetailResponse(
    Guid Id,
    string FirstName,
    string LastName,
    string Agency,
    CrewRole Role,
    DateOnly DateOfBirth,
    int Age,
    Guid? MissionId,
    string? MissionName,
    HealthStatus HealthStatus,
    int OpenAlerts,
    VitalReadingResponse? LatestReading);

public sealed record AstronautQuery(
    string? Search = null,
    Guid? MissionId = null,
    HealthStatus? Status = null,
    int Page = 1,
    int PageSize = 20);

public sealed record UpsertAstronautRequest(
    string FirstName,
    string LastName,
    string Agency,
    CrewRole Role,
    DateOnly DateOfBirth,
    Guid? MissionId);
