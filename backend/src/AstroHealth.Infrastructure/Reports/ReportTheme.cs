using System.Globalization;
using System.Text.RegularExpressions;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Alerts;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Vitals;

namespace AstroHealth.Infrastructure.Reports;

/// <summary>
/// Shared design tokens for every exported document (PDF and Excel), mirroring the web app's
/// light theme so a printed report looks like the product it came from.
/// </summary>
internal static partial class ReportTheme
{
    public const string Brand = "VITA";
    public const string BrandFull = "Vital Integrated Telemetry for Astronauts";
    public const string Disclaimer = "Demonstration system, not for clinical use";
    public const string Classification = "Confidential · crew medical data";

    // Palette: the web app's light-theme tokens (globals.css). Text colours meet WCAG AA on white.
    public const string Ink = "#111114";
    public const string Muted = "#5C5C66";
    public const string Faint = "#71717B";
    public const string Line = "#EBEBEE";
    public const string LineStrong = "#DCDCE1";
    public const string Panel = "#F7F7F8";
    public const string Raised = "#F4F4F5";
    /// <summary>Header fill for spreadsheet tables (PDF tables use hairlines instead).</summary>
    public const string HeaderFill = "#111114";
    public const string Accent = "#4F5FF0";
    public const string AccentSoft = "#EEF0FE";
    public const string Nominal = "#0B7F3D";
    public const string NominalSoft = "#EAF6EF";
    public const string Caution = "#B45309";
    public const string CautionSoft = "#FDF3E6";
    public const string Critical = "#D1343A";
    public const string CriticalSoft = "#FCEDEE";
    public const string Violet = "#6B5BD6";
    public const string VioletSoft = "#F1EFFC";

    public enum Tone { Neutral, Nominal, Caution, Critical, Accent, Violet }

    public static (string Fg, string Bg) Palette(Tone tone) => tone switch
    {
        Tone.Nominal => (Nominal, NominalSoft),
        Tone.Caution => (Caution, CautionSoft),
        Tone.Critical => (Critical, CriticalSoft),
        Tone.Accent => (Accent, AccentSoft),
        Tone.Violet => (Violet, VioletSoft),
        _ => (Muted, Panel)
    };

    public static Tone ToneOf(HealthStatus status) => status switch
    {
        HealthStatus.Critical => Tone.Critical,
        HealthStatus.Caution => Tone.Caution,
        HealthStatus.Nominal => Tone.Nominal,
        _ => Tone.Neutral
    };

    public static Tone ToneOf(AlertSeverity severity) => severity == AlertSeverity.Critical ? Tone.Critical : Tone.Caution;

    public static Tone ToneOf(AlertStatus status) => status switch
    {
        AlertStatus.Open => Tone.Accent,
        AlertStatus.Acknowledged => Tone.Neutral,
        _ => Tone.Neutral
    };

    public static Tone ToneOf(EarlyWarningRisk risk) => risk switch
    {
        EarlyWarningRisk.High => Tone.Critical,
        EarlyWarningRisk.Medium or EarlyWarningRisk.LowMedium => Tone.Caution,
        _ => Tone.Nominal
    };

    /// <summary>Colour a vital value by its thresholds (same rules as the web UI).</summary>
    public static Tone ToneOf(decimal value, ThresholdResponse? t)
    {
        if (t is null) return Tone.Neutral;
        if (value < t.CriticalLow || value > t.CriticalHigh) return Tone.Critical;
        if (value < t.WarningLow || value > t.WarningHigh) return Tone.Caution;
        return Tone.Nominal;
    }

    public static decimal ValueOf(VitalReadingResponse r, VitalMetric metric) => metric switch
    {
        VitalMetric.HeartRate => r.HeartRateBpm,
        VitalMetric.SystolicPressure => r.SystolicMmHg,
        VitalMetric.DiastolicPressure => r.DiastolicMmHg,
        VitalMetric.OxygenSaturation => r.OxygenSaturationPct,
        VitalMetric.BodyTemperature => r.BodyTemperatureC,
        VitalMetric.RespiratoryRate => r.RespiratoryRatePerMin,
        VitalMetric.RadiationDose => r.RadiationDoseRateMsvPerDay ?? 0,
        _ => 0
    };

    /// <summary>"FlightEngineer" → "Flight Engineer", "LowMedium" → "Low Medium".</summary>
    public static string Humanize(object value) => PascalBoundary().Replace(value.ToString() ?? "", "$1 $2");

    public static string Utc(DateTimeOffset value) =>
        value.UtcDateTime.ToString("yyyy-MM-dd HH:mm 'UTC'", CultureInfo.InvariantCulture);

    /// <summary>Compact table timestamp (the column header states UTC).</summary>
    public static string Short(DateTimeOffset value) =>
        value.UtcDateTime.ToString("dd MMM HH:mm", CultureInfo.InvariantCulture);

    /// <summary>Typographic unit for print (the API uses plain "C").</summary>
    public static string DisplayUnit(string unit) => unit == "C" ? "°C" : unit;

    public static string Number(decimal value, int decimals = 1) =>
        value.ToString(decimals == 0 ? "0" : "0." + new string('#', decimals), CultureInfo.InvariantCulture);

    public static string SafeRange(ThresholdResponse t) => (t.WarningLow, t.WarningHigh) switch
    {
        ({ } lo, { } hi) => $"{Number(lo)}–{Number(hi)} {DisplayUnit(t.Unit)}",
        ({ } lo, null) => $"≥ {Number(lo)} {DisplayUnit(t.Unit)}",
        (null, { } hi) => $"≤ {Number(hi)} {DisplayUnit(t.Unit)}",
        _ => DisplayUnit(t.Unit)
    };

    /// <summary>vita-fleet-report-20261017-1530Z.pdf</summary>
    public static string FileName(string slug, string extension, DateTimeOffset at) =>
        $"vita-{Slug(slug)}-{at.UtcDateTime:yyyyMMdd-HHmm}Z.{extension}";

    private static string Slug(string text) => NonSlug().Replace(text.ToLowerInvariant(), "-").Trim('-');

    [GeneratedRegex("([a-z])([A-Z])")]
    private static partial Regex PascalBoundary();

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonSlug();
}
