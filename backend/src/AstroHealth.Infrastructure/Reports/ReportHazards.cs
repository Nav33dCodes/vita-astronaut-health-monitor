using System.Globalization;
using System.Text;
using AstroHealth.Application.Hazards;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Hazards;
using static AstroHealth.Infrastructure.Reports.ReportTheme;

namespace AstroHealth.Infrastructure.Reports;

/// <summary>Wording and small visuals for the five-hazards sections of the reports.</summary>
internal static class ReportHazards
{
    public static readonly SpaceHazard[] Order =
    [
        SpaceHazard.SpaceRadiation,
        SpaceHazard.IsolationAndConfinement,
        SpaceHazard.DistanceFromEarth,
        SpaceHazard.GravityFields,
        SpaceHazard.HostileClosedEnvironments
    ];

    public static string Label(SpaceHazard hazard) => hazard switch
    {
        SpaceHazard.SpaceRadiation => "Space radiation",
        SpaceHazard.IsolationAndConfinement => "Isolation and confinement",
        SpaceHazard.DistanceFromEarth => "Distance from Earth",
        SpaceHazard.GravityFields => "Gravity fields",
        SpaceHazard.HostileClosedEnvironments => "Hostile and closed environments",
        _ => hazard.ToString()
    };

    public static string Monitors(SpaceHazard hazard) => hazard switch
    {
        SpaceHazard.SpaceRadiation => "Dosimeter dose rate, mission dose against the 600 mSv career limit",
        SpaceHazard.IsolationAndConfinement => "Wrist actigraphy (sleep, activity, light) and daily check-ins",
        SpaceHazard.DistanceFromEarth => "Signal delay per destination, onboard first-response checklists",
        SpaceHazard.GravityFields => "Heart rate and blood pressure, days in reduced gravity",
        SpaceHazard.HostileClosedEnvironments => "Cabin CO₂, oxygen, pressure, temperature, humidity; blood oxygen",
        _ => ""
    };

    public static Tone ToneOf(HealthStatus status) => ReportTheme.ToneOf(status);

    public static string StatusLabel(HealthStatus status) => status == HealthStatus.Unknown ? "No data" : status.ToString();

    /// <summary>"1.3 s", "3–22 min", "real time".</summary>
    public static string SignalDelay(CommunicationDelayResponse delay)
    {
        var (min, max) = (delay.OneWayMinSeconds, delay.OneWayMaxSeconds);
        if (max < 1) return "Real time";
        if (max < 60) return $"{max.ToString("0.#", CultureInfo.InvariantCulture)} s";
        return Math.Abs(min - max) < 0.5 ? $"{max / 60:0} min" : $"{min / 60:0}–{max / 60:0} min";
    }

    public static Tone HabitatTone(HabitatMetric metric, decimal value)
    {
        var t = HabitatEvaluator.Thresholds.First(x => x.Metric == metric);
        if (value < t.CriticalLow || value > t.CriticalHigh) return Tone.Critical;
        if (value < t.WarningLow || value > t.WarningHigh) return Tone.Caution;
        return Tone.Nominal;
    }

    /// <summary>Nightly sleep bars with the 6 h caution line, oldest night on the left.</summary>
    public static string SleepChart(IReadOnlyList<WellnessEntryResponse> newestFirst, int width = 240, int height = 70)
    {
        var nights = newestFirst.Where(e => e.SleepHours > 0).Reverse().ToList();
        var svg = new StringBuilder();
        svg.Append(CultureInfo.InvariantCulture, $"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{width}\" height=\"{height}\" viewBox=\"0 0 {width} {height}\">");
        if (nights.Count == 0)
        {
            svg.Append(CultureInfo.InvariantCulture, $"<text x=\"{width / 2}\" y=\"{height / 2}\" text-anchor=\"middle\" font-family=\"Helvetica, Arial, sans-serif\" font-size=\"8\" fill=\"{Faint}\">No actigraphy yet</text></svg>");
            return svg.ToString();
        }

        const double maxHours = 9;
        const int bottom = 12, top = 4;
        var plotH = height - top - bottom;
        var slot = (double)width / nights.Count;
        var barW = Math.Min(18, slot * 0.6);
        double Y(double h) => top + (1 - h / maxHours) * plotH;

        svg.Append(CultureInfo.InvariantCulture, $"<line x1=\"0\" x2=\"{width}\" y1=\"{Y(6):0.##}\" y2=\"{Y(6):0.##}\" stroke=\"{Caution}\" stroke-width=\"0.6\" stroke-dasharray=\"3 3\"/>");
        for (var i = 0; i < nights.Count; i++)
        {
            var hours = (double)nights[i].SleepHours;
            var color = hours < 5 ? Critical : hours < 6 ? Caution : Accent;
            var x = i * slot + (slot - barW) / 2;
            svg.Append(CultureInfo.InvariantCulture, $"<rect x=\"{x:0.##}\" y=\"{Y(hours):0.##}\" width=\"{barW:0.##}\" height=\"{(height - bottom) - Y(hours):0.##}\" rx=\"2\" fill=\"{color}\" fill-opacity=\"0.85\"/>");
            svg.Append(CultureInfo.InvariantCulture, $"<text x=\"{x + barW / 2:0.##}\" y=\"{height - 2}\" text-anchor=\"middle\" font-family=\"Helvetica, Arial, sans-serif\" font-size=\"6\" fill=\"{Faint}\">{nights[i].Date:dd}</text>");
        }

        svg.Append("</svg>");
        return svg.ToString();
    }
}
