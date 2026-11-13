using AstroHealth.Application.Abstractions;
using AstroHealth.Domain.Common;
using AstroHealth.Domain.Hazards;
using AstroHealth.Domain.Missions;
using Microsoft.EntityFrameworkCore;

namespace AstroHealth.Application.Hazards;

public interface IHabitatService
{
    Task<Result<HabitatReadingResponse>> RecordAsync(Guid missionId, RecordHabitatRequest request, CancellationToken ct);
    Task<Result<IReadOnlyList<HabitatReadingResponse>>> GetHistoryAsync(Guid missionId, int minutes, CancellationToken ct);
    IReadOnlyList<HabitatThresholdResponse> GetThresholds();
}

internal sealed class HabitatService(IAppDbContext db, ITelemetryPublisher publisher, TimeProvider clock) : IHabitatService
{
    public async Task<Result<HabitatReadingResponse>> RecordAsync(Guid missionId, RecordHabitatRequest request, CancellationToken ct)
    {
        var mission = await db.Missions.AsNoTracking()
            .Where(m => m.Id == missionId)
            .Select(m => new { m.Name })
            .FirstOrDefaultAsync(ct);

        if (mission is null)
        {
            return MissionErrors.NotFound(missionId);
        }

        var reading = new HabitatReading(
            missionId,
            request.RecordedAtUtc?.ToUniversalTime() ?? clock.GetUtcNow(),
            request.CarbonDioxideMmHg,
            request.OxygenPct,
            request.CabinPressureKpa,
            request.CabinTemperatureC,
            request.HumidityPct,
            request.RadiationDoseRateMsvPerDay);

        db.HabitatReadings.Add(reading);
        await db.SaveChangesAsync(ct);

        var response = HabitatReadingResponse.From(reading);
        await publisher.HabitatUpdatedAsync(new HabitatUpdatedEvent(response, mission.Name), CancellationToken.None);
        return response;
    }

    public async Task<Result<IReadOnlyList<HabitatReadingResponse>>> GetHistoryAsync(Guid missionId, int minutes, CancellationToken ct)
    {
        if (!await db.Missions.AnyAsync(m => m.Id == missionId, ct))
        {
            return MissionErrors.NotFound(missionId);
        }

        var since = clock.GetUtcNow().AddMinutes(-minutes);
        var rows = await db.HabitatReadings.AsNoTracking()
            .Where(h => h.MissionId == missionId && h.RecordedAtUtc >= since)
            .OrderBy(h => h.RecordedAtUtc)
            .ToListAsync(ct);

        return rows.Select(HabitatReadingResponse.From).ToList();
    }

    public IReadOnlyList<HabitatThresholdResponse> GetThresholds() =>
        HabitatEvaluator.Thresholds
            .Select(t => new HabitatThresholdResponse(t.Metric, t.Label, t.Unit, t.WarningLow, t.WarningHigh, t.CriticalLow, t.CriticalHigh))
            .ToList();
}
