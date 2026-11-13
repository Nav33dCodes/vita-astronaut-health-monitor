using AstroHealth.Application.Abstractions;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Common;
using AstroHealth.Domain.Hazards;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace AstroHealth.Application.Hazards;

public interface IWellnessService
{
    Task<Result<WellnessResponse>> GetAsync(Guid astronautId, int days, CancellationToken ct);
    Task<Result<WellnessResponse>> CheckInAsync(Guid astronautId, WellnessCheckInRequest request, CancellationToken ct);
    Task<Result<WellnessEntryResponse>> RecordActigraphyAsync(Guid astronautId, RecordActigraphyRequest request, CancellationToken ct);
}

internal sealed class WellnessService(IAppDbContext db, TimeProvider clock) : IWellnessService
{
    public async Task<Result<WellnessResponse>> GetAsync(Guid astronautId, int days, CancellationToken ct)
    {
        if (!await db.Astronauts.AnyAsync(a => a.Id == astronautId, ct))
        {
            return AstronautErrors.NotFound(astronautId);
        }

        return await BuildAsync(astronautId, days, ct);
    }

    public async Task<Result<WellnessResponse>> CheckInAsync(Guid astronautId, WellnessCheckInRequest request, CancellationToken ct)
    {
        if (!await db.Astronauts.AnyAsync(a => a.Id == astronautId, ct))
        {
            return AstronautErrors.NotFound(astronautId);
        }

        var now = clock.GetUtcNow();
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var entry = await db.WellnessEntries.FirstOrDefaultAsync(e => e.AstronautId == astronautId && e.Date == today, ct);
        if (entry is null)
        {
            // No actigraphy yet today: the check-in still counts.
            entry = new WellnessEntry(astronautId, today, 0, 0, 0, 0);
            db.WellnessEntries.Add(entry);
        }

        entry.CheckIn(request.Mood, request.Stress, request.Workload, string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(), now);
        await db.SaveChangesAsync(ct);

        return await BuildAsync(astronautId, 14, ct);
    }

    public async Task<Result<WellnessEntryResponse>> RecordActigraphyAsync(Guid astronautId, RecordActigraphyRequest request, CancellationToken ct)
    {
        if (!await db.Astronauts.AnyAsync(a => a.Id == astronautId, ct))
        {
            return AstronautErrors.NotFound(astronautId);
        }

        var entry = await db.WellnessEntries.FirstOrDefaultAsync(e => e.AstronautId == astronautId && e.Date == request.Date, ct);
        if (entry is null)
        {
            entry = new WellnessEntry(astronautId, request.Date, request.SleepHours, request.SleepEfficiencyPct, request.ActiveMinutes, request.LightExposureHours);
            db.WellnessEntries.Add(entry);
        }
        else
        {
            entry.UpdateActigraphy(request.SleepHours, request.SleepEfficiencyPct, request.ActiveMinutes, request.LightExposureHours);
        }

        await db.SaveChangesAsync(ct);
        return WellnessEntryResponse.From(entry);
    }

    private async Task<WellnessResponse> BuildAsync(Guid astronautId, int days, CancellationToken ct)
    {
        var since = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime).AddDays(-(days - 1));
        var entries = await db.WellnessEntries.AsNoTracking()
            .Where(e => e.AstronautId == astronautId && e.Date >= since)
            .OrderByDescending(e => e.Date)
            .ToListAsync(ct);

        return ToResponse(astronautId, days, entries);
    }

    /// <param name="entries">Newest first.</param>
    internal static WellnessResponse ToResponse(Guid astronautId, int days, IReadOnlyList<WellnessEntry> entries)
    {
        var withSleep = entries.Where(e => e.SleepHours > 0).ToList();
        var findings = WellnessEvaluator.Evaluate(entries);
        var status = entries.Count == 0
            ? HealthStatus.Unknown
            : findings.Count == 0 ? HealthStatus.Nominal : findings.Max(f => f.Status);

        return new WellnessResponse(
            astronautId,
            days,
            withSleep.Count == 0 ? null : Math.Round(withSleep.Take(3).Average(e => e.SleepHours), 1),
            status,
            findings.Select(f => new WellnessFindingResponse(f.Status, f.Message)).ToList(),
            entries.Select(WellnessEntryResponse.From).ToList());
    }
}

internal sealed class WellnessCheckInValidator : AbstractValidator<WellnessCheckInRequest>
{
    public WellnessCheckInValidator()
    {
        RuleFor(x => x.Mood).InclusiveBetween(1, 5);
        RuleFor(x => x.Stress).InclusiveBetween(1, 5);
        RuleFor(x => x.Workload).InclusiveBetween(1, 5);
        RuleFor(x => x.Note).MaximumLength(300);
    }
}

internal sealed class RecordHabitatValidator : AbstractValidator<RecordHabitatRequest>
{
    public RecordHabitatValidator()
    {
        RuleFor(x => x.CarbonDioxideMmHg).InclusiveBetween(0, 100);
        RuleFor(x => x.OxygenPct).InclusiveBetween(0, 100);
        RuleFor(x => x.CabinPressureKpa).InclusiveBetween(0, 200);
        RuleFor(x => x.CabinTemperatureC).InclusiveBetween(-50, 80);
        RuleFor(x => x.HumidityPct).InclusiveBetween(0, 100);
        RuleFor(x => x.RadiationDoseRateMsvPerDay).InclusiveBetween(0, 10000);
    }
}
