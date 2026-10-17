using System.Linq.Expressions;
using AstroHealth.Application.Abstractions;
using AstroHealth.Domain.Common;
using AstroHealth.Domain.Missions;
using Microsoft.EntityFrameworkCore;

namespace AstroHealth.Application.Missions;

public interface IMissionService
{
    Task<IReadOnlyList<MissionResponse>> ListAsync(MissionStatus? status, CancellationToken ct);
    Task<Result<MissionResponse>> GetAsync(Guid id, CancellationToken ct);
    Task<Result<MissionResponse>> CreateAsync(CreateMissionRequest request, CancellationToken ct);
    Task<Result<MissionResponse>> UpdateAsync(Guid id, UpdateMissionRequest request, CancellationToken ct);
    Task<Result<MissionResponse>> ChangeStatusAsync(Guid id, ChangeMissionStatusRequest request, CancellationToken ct);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct);
}

internal sealed class MissionService(IAppDbContext db) : IMissionService
{
    private static readonly Expression<Func<Mission, MissionResponse>> ToResponse = m => new MissionResponse(
        m.Id, m.Name, m.Description, m.Destination, m.Status, m.LaunchDate, m.EndDate, m.Crew.Count);

    public async Task<IReadOnlyList<MissionResponse>> ListAsync(MissionStatus? status, CancellationToken ct)
    {
        var query = db.Missions.AsNoTracking();

        if (status is not null)
        {
            query = query.Where(m => m.Status == status);
        }

        return await query.OrderBy(m => m.LaunchDate).Select(ToResponse).ToListAsync(ct);
    }

    public async Task<Result<MissionResponse>> GetAsync(Guid id, CancellationToken ct)
    {
        var mission = await db.Missions.AsNoTracking()
            .Where(m => m.Id == id)
            .Select(ToResponse)
            .FirstOrDefaultAsync(ct);

        return mission is null ? MissionErrors.NotFound(id) : mission;
    }

    public async Task<Result<MissionResponse>> CreateAsync(CreateMissionRequest request, CancellationToken ct)
    {
        if (await db.Missions.AnyAsync(m => m.Name == request.Name, ct))
        {
            return MissionErrors.NameTaken(request.Name);
        }

        var mission = new Mission(request.Name.Trim(), request.Destination, request.LaunchDate, request.Description);
        db.Missions.Add(mission);
        await db.SaveChangesAsync(ct);

        return await GetAsync(mission.Id, ct);
    }

    public async Task<Result<MissionResponse>> UpdateAsync(Guid id, UpdateMissionRequest request, CancellationToken ct)
    {
        var mission = await db.Missions.FirstOrDefaultAsync(m => m.Id == id, ct);
        if (mission is null)
        {
            return MissionErrors.NotFound(id);
        }

        if (await db.Missions.AnyAsync(m => m.Id != id && m.Name == request.Name, ct))
        {
            return MissionErrors.NameTaken(request.Name);
        }

        mission.Update(request.Name.Trim(), request.Destination, request.LaunchDate, request.EndDate, request.Description);
        await db.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    public async Task<Result<MissionResponse>> ChangeStatusAsync(Guid id, ChangeMissionStatusRequest request, CancellationToken ct)
    {
        var mission = await db.Missions.FirstOrDefaultAsync(m => m.Id == id, ct);
        if (mission is null)
        {
            return MissionErrors.NotFound(id);
        }

        var result = mission.ChangeStatus(request.Status);
        if (result.IsFailure)
        {
            return result.Error;
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct)
    {
        var mission = await db.Missions.Include(m => m.Crew).FirstOrDefaultAsync(m => m.Id == id, ct);
        if (mission is null)
        {
            return MissionErrors.NotFound(id);
        }

        if (mission.Crew.Count > 0)
        {
            return MissionErrors.HasCrew(id);
        }

        db.Missions.Remove(mission);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
