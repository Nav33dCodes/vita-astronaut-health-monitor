using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Hazards;
using AstroHealth.Domain.Missions;
using AstroHealth.Domain.Vitals;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AstroHealth.Infrastructure.Persistence;

internal sealed class MissionConfiguration : IEntityTypeConfiguration<Mission>
{
    public void Configure(EntityTypeBuilder<Mission> builder)
    {
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Name).HasMaxLength(100).IsRequired();
        builder.Property(m => m.Description).HasMaxLength(1000);
        builder.HasIndex(m => m.Name).IsUnique();
        builder.HasIndex(m => m.Status);

        builder.HasMany(m => m.Crew)
            .WithOne(a => a.Mission)
            .HasForeignKey(a => a.MissionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class AstronautConfiguration : IEntityTypeConfiguration<Astronaut>
{
    public void Configure(EntityTypeBuilder<Astronaut> builder)
    {
        builder.HasKey(a => a.Id);
        builder.Property(a => a.FirstName).HasMaxLength(60).IsRequired();
        builder.Property(a => a.LastName).HasMaxLength(60).IsRequired();
        builder.Property(a => a.Agency).HasMaxLength(60).IsRequired();
        builder.Property(a => a.MissionDoseMsv).HasPrecision(12, 4);
        builder.HasIndex(a => new { a.LastName, a.FirstName });

        builder.HasMany(a => a.Readings)
            .WithOne()
            .HasForeignKey(r => r.AstronautId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(a => a.Alerts)
            .WithOne(x => x.Astronaut)
            .HasForeignKey(x => x.AstronautId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class VitalReadingConfiguration : IEntityTypeConfiguration<VitalReading>
{
    public void Configure(EntityTypeBuilder<VitalReading> builder)
    {
        builder.HasKey(r => r.Id);
        builder.Property(r => r.OxygenSaturationPct).HasPrecision(5, 2);
        builder.Property(r => r.BodyTemperatureC).HasPrecision(4, 2);
        builder.Property(r => r.RadiationDoseMsv).HasPrecision(12, 6);
        builder.Property(r => r.RadiationDoseRateMsvPerDay).HasPrecision(9, 3);
        builder.Property(r => r.Notes).HasMaxLength(500);
        builder.HasIndex(r => new { r.AstronautId, r.RecordedAtUtc });

        // Append-only time series: a BRIN index is tiny and ideal for time-range scans
        // (dashboard counts, retention). Ignored by providers that don't support it.
        builder.HasIndex(r => r.RecordedAtUtc).HasMethod("brin");
    }
}

internal sealed class VitalRollupConfiguration : IEntityTypeConfiguration<VitalRollup>
{
    public void Configure(EntityTypeBuilder<VitalRollup> builder)
    {
        builder.HasKey(r => new { r.AstronautId, r.BucketStartUtc });

        foreach (var property in new[]
                 {
                     nameof(VitalRollup.AvgHeartRateBpm), nameof(VitalRollup.AvgSystolicMmHg),
                     nameof(VitalRollup.AvgDiastolicMmHg), nameof(VitalRollup.AvgRespiratoryRatePerMin)
                 })
        {
            builder.Property(property).HasPrecision(6, 2);
        }

        builder.Property(r => r.AvgOxygenSaturationPct).HasPrecision(5, 2);
        builder.Property(r => r.MinOxygenSaturationPct).HasPrecision(5, 2);
        builder.Property(r => r.AvgBodyTemperatureC).HasPrecision(4, 2);
        builder.Property(r => r.MaxBodyTemperatureC).HasPrecision(4, 2);
        builder.Property(r => r.AvgRadiationDoseMsv).HasPrecision(9, 4);
        builder.Property(r => r.TotalRadiationDoseMsv).HasPrecision(12, 4);

        builder.HasOne<Astronaut>()
            .WithMany()
            .HasForeignKey(r => r.AstronautId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class HealthAlertConfiguration : IEntityTypeConfiguration<HealthAlert>
{
    public void Configure(EntityTypeBuilder<HealthAlert> builder)
    {
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Message).HasMaxLength(300).IsRequired();
        builder.Property(a => a.ObservedValue).HasPrecision(10, 3);
        builder.Property(a => a.ResolutionNote).HasMaxLength(500);
        builder.HasIndex(a => new { a.AstronautId, a.Status });
        builder.HasIndex(a => new { a.Status, a.Severity });

        // Alerts outlive raw readings (which retention rolls up and deletes).
        builder.HasOne<VitalReading>()
            .WithMany()
            .HasForeignKey(a => a.VitalReadingId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

internal sealed class HabitatReadingConfiguration : IEntityTypeConfiguration<HabitatReading>
{
    public void Configure(EntityTypeBuilder<HabitatReading> builder)
    {
        builder.HasKey(h => h.Id);
        builder.Property(h => h.CarbonDioxideMmHg).HasPrecision(6, 2);
        builder.Property(h => h.OxygenPct).HasPrecision(5, 2);
        builder.Property(h => h.CabinPressureKpa).HasPrecision(6, 2);
        builder.Property(h => h.CabinTemperatureC).HasPrecision(5, 2);
        builder.Property(h => h.HumidityPct).HasPrecision(5, 2);
        builder.Property(h => h.RadiationDoseRateMsvPerDay).HasPrecision(9, 3);
        builder.HasIndex(h => new { h.MissionId, h.RecordedAtUtc });

        builder.HasOne<Mission>()
            .WithMany()
            .HasForeignKey(h => h.MissionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class WellnessEntryConfiguration : IEntityTypeConfiguration<WellnessEntry>
{
    public void Configure(EntityTypeBuilder<WellnessEntry> builder)
    {
        builder.HasKey(w => w.Id);
        builder.Property(w => w.SleepHours).HasPrecision(4, 2);
        builder.Property(w => w.LightExposureHours).HasPrecision(4, 2);
        builder.Property(w => w.CheckInNote).HasMaxLength(300);
        builder.HasIndex(w => new { w.AstronautId, w.Date }).IsUnique();

        builder.HasOne<Astronaut>()
            .WithMany()
            .HasForeignKey(w => w.AstronautId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
