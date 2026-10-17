using AstroHealth.Application.Abstractions;
using AstroHealth.Application.Common;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Common;
using AstroHealth.Domain.Missions;
using Microsoft.EntityFrameworkCore;

namespace AstroHealth.Application.Astronauts;

public interface IAstronautService
{
    Task<PagedResult<AstronautSummaryResponse>> ListAsync(AstronautQuery query, CancellationToken ct);
    Task<Result<AstronautDetailResponse>> GetAsync(Guid id, CancellationToken ct);
    Task<Result<AstronautDetailResponse>> CreateAsync(UpsertAstronautRequest request, CancellationToken ct);
    Task<Result<AstronautDetailResponse>> UpdateAsync(Guid id, UpsertAstronautRequest request, CancellationToken ct);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct);
}

internal sealed class AstronautService(IAppDbContext db, TimeProvider clock) : IAstronautService
{
    public async Task<PagedResult<AstronautSummaryResponse>> ListAsync(AstronautQuery query, CancellationToken ct)
    {
        var astronauts = db.Astronauts.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            astronauts = astronauts.Where(a =>
                a.FirstName.ToLower().Contains(term) ||
                a.LastName.ToLower().Contains(term) ||
                a.Agency.ToLower().Contains(term));
        }

        if (query.MissionId is not null)
        {
            astronauts = astronauts.Where(a => a.MissionId == query.MissionId);
        }

        astronauts = query.Status switch
        {
            HealthStatus.Critical => astronauts.Where(HealthStatusRules.IsCritical),
            HealthStatus.Caution => astronauts.Where(HealthStatusRules.IsCaution),
            HealthStatus.Nominal => astronauts.Where(HealthStatusRules.IsNominal),
            HealthStatus.Unknown => astronauts.Where(HealthStatusRules.IsUnknown),
            _ => astronauts
        };

        var page = await astronauts
            .OrderBy(a => a.LastName).ThenBy(a => a.FirstName)
            .Select(a => new
            {
                a.Id,
                a.FirstName,
                a.LastName,
                a.Agency,
                a.Role,
                a.MissionId,
                MissionName = a.Mission != null ? a.Mission.Name : null,
                OpenCritical = a.Alerts.Count(x => x.Status != AlertStatus.Resolved && x.Severity == AlertSeverity.Critical),
                OpenWarning = a.Alerts.Count(x => x.Status != AlertStatus.Resolved && x.Severity == AlertSeverity.Warning),
                LastReadingAtUtc = a.Readings
                    .OrderByDescending(r => r.RecordedAtUtc)
                    .Select(r => (DateTimeOffset?)r.RecordedAtUtc)
                    .FirstOrDefault()
            })
            .ToPagedResultAsync(query.Page, query.PageSize, ct);

        var items = page.Items
            .Select(x => new AstronautSummaryResponse(
                x.Id, x.FirstName, x.LastName, x.Agency, x.Role, x.MissionId, x.MissionName,
                HealthStatusRules.From(x.OpenCritical, x.OpenWarning, x.LastReadingAtUtc is not null),
                x.OpenCritical + x.OpenWarning,
                x.LastReadingAtUtc))
            .ToList();

        return new PagedResult<AstronautSummaryResponse>(items, page.Page, page.PageSize, page.TotalCount);
    }

    public async Task<Result<AstronautDetailResponse>> GetAsync(Guid id, CancellationToken ct)
    {
        var row = await db.Astronauts.AsNoTracking()
            .Where(a => a.Id == id)
            .Select(a => new
            {
                Astronaut = a,
                MissionName = a.Mission != null ? a.Mission.Name : null,
                OpenCritical = a.Alerts.Count(x => x.Status != AlertStatus.Resolved && x.Severity == AlertSeverity.Critical),
                OpenWarning = a.Alerts.Count(x => x.Status != AlertStatus.Resolved && x.Severity == AlertSeverity.Warning),
                Latest = a.Readings.OrderByDescending(r => r.RecordedAtUtc).FirstOrDefault()
            })
            .FirstOrDefaultAsync(ct);

        if (row is null)
        {
            return AstronautErrors.NotFound(id);
        }

        var a = row.Astronaut;
        return new AstronautDetailResponse(
            a.Id, a.FirstName, a.LastName, a.Agency, a.Role, a.DateOfBirth, AgeOn(a.DateOfBirth),
            a.MissionId, row.MissionName,
            HealthStatusRules.From(row.OpenCritical, row.OpenWarning, row.Latest is not null),
            row.OpenCritical + row.OpenWarning,
            row.Latest is null ? null : VitalReadingResponse.From(row.Latest));
    }

    public async Task<Result<AstronautDetailResponse>> CreateAsync(UpsertAstronautRequest request, CancellationToken ct)
    {
        if (request.MissionId is { } missionId && !await db.Missions.AnyAsync(m => m.Id == missionId, ct))
        {
            return MissionErrors.NotFound(missionId);
        }

        var astronaut = new Astronaut(
            request.FirstName.Trim(), request.LastName.Trim(), request.Agency.Trim(),
            request.Role, request.DateOfBirth, request.MissionId);

        db.Astronauts.Add(astronaut);
        await db.SaveChangesAsync(ct);

        return await GetAsync(astronaut.Id, ct);
    }

    public async Task<Result<AstronautDetailResponse>> UpdateAsync(Guid id, UpsertAstronautRequest request, CancellationToken ct)
    {
        var astronaut = await db.Astronauts.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (astronaut is null)
        {
            return AstronautErrors.NotFound(id);
        }

        if (request.MissionId is { } missionId && !await db.Missions.AnyAsync(m => m.Id == missionId, ct))
        {
            return MissionErrors.NotFound(missionId);
        }

        astronaut.Update(
            request.FirstName.Trim(), request.LastName.Trim(), request.Agency.Trim(),
            request.Role, request.DateOfBirth, request.MissionId);
        await db.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct)
    {
        var deleted = await db.Astronauts.Where(a => a.Id == id).ExecuteDeleteAsync(ct);
        return deleted == 0 ? AstronautErrors.NotFound(id) : Result.Success();
    }

    private int AgeOn(DateOnly dateOfBirth)
    {
        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var age = today.Year - dateOfBirth.Year;
        return dateOfBirth > today.AddYears(-age) ? age - 1 : age;
    }
}
