using FluentValidation;

namespace AstroHealth.Application.Astronauts;

public sealed class UpsertAstronautRequestValidator : AbstractValidator<UpsertAstronautRequest>
{
    public UpsertAstronautRequestValidator(TimeProvider clock)
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(60);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(60);
        RuleFor(x => x.Agency).NotEmpty().MaximumLength(60);
        RuleFor(x => x.Role).IsInEnum();
        RuleFor(x => x.DateOfBirth)
            .Must(dob =>
            {
                var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
                return dob <= today.AddYears(-21) && dob >= today.AddYears(-80);
            })
            .WithMessage("Astronauts must be between 21 and 80 years old.");
    }
}

public sealed class AstronautQueryValidator : AbstractValidator<AstronautQuery>
{
    public AstronautQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
        RuleFor(x => x.Search).MaximumLength(100);
        RuleFor(x => x.Status).IsInEnum().When(x => x.Status.HasValue);
    }
}
