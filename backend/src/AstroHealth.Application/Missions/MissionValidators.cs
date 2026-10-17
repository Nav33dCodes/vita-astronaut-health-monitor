using FluentValidation;

namespace AstroHealth.Application.Missions;

public sealed class CreateMissionRequestValidator : AbstractValidator<CreateMissionRequest>
{
    public CreateMissionRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Destination).IsInEnum();
        RuleFor(x => x.Description).MaximumLength(1000);
    }
}

public sealed class UpdateMissionRequestValidator : AbstractValidator<UpdateMissionRequest>
{
    public UpdateMissionRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Destination).IsInEnum();
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.LaunchDate)
            .When(x => x.EndDate.HasValue)
            .WithMessage("End date cannot be before the launch date.");
    }
}

public sealed class ChangeMissionStatusRequestValidator : AbstractValidator<ChangeMissionStatusRequest>
{
    public ChangeMissionStatusRequestValidator()
    {
        RuleFor(x => x.Status).IsInEnum();
    }
}
