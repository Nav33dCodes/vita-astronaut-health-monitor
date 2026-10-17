using FluentValidation;

namespace AstroHealth.Application.Vitals;

/// <summary>Rejects physiologically impossible values (sensor faults), not merely unhealthy ones.</summary>
public sealed class RecordVitalsRequestValidator : AbstractValidator<RecordVitalsRequest>
{
    public RecordVitalsRequestValidator(TimeProvider clock)
    {
        RuleFor(x => x.HeartRateBpm).InclusiveBetween(20, 250);
        RuleFor(x => x.SystolicMmHg).InclusiveBetween(50, 260);
        RuleFor(x => x.DiastolicMmHg).InclusiveBetween(30, 160)
            .LessThan(x => x.SystolicMmHg).WithMessage("Diastolic pressure must be lower than systolic pressure.");
        RuleFor(x => x.OxygenSaturationPct).InclusiveBetween(50, 100).PrecisionScale(5, 2, true);
        RuleFor(x => x.BodyTemperatureC).InclusiveBetween(30, 45).PrecisionScale(4, 2, true);
        RuleFor(x => x.RespiratoryRatePerMin).InclusiveBetween(4, 60);
        RuleFor(x => x.RadiationDoseMsv).InclusiveBetween(0, 1000).PrecisionScale(9, 4, true);
        RuleFor(x => x.Notes).MaximumLength(500);
        RuleFor(x => x.RecordedAtUtc)
            .Must(t => t <= clock.GetUtcNow().AddMinutes(5))
            .When(x => x.RecordedAtUtc.HasValue)
            .WithMessage("Readings cannot be recorded in the future.");
    }
}

public sealed class VitalsQueryValidator : AbstractValidator<VitalsQuery>
{
    public VitalsQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 500);
        RuleFor(x => x.To)
            .GreaterThanOrEqualTo(x => x.From)
            .When(x => x.From.HasValue && x.To.HasValue)
            .WithMessage("'To' must be after 'From'.");
    }
}
