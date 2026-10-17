using System.Globalization;
using System.Text;
using AstroHealth.Application.Vitals;

namespace AstroHealth.Infrastructure.Reports;

/// <summary>
/// Minimal, print-quality line chart rendered as SVG (QuestPDF embeds it as vectors, so it stays
/// crisp at any zoom). Shows the safe band, light gridlines with labels, the series and its last value.
/// </summary>
internal static class ChartSvg
{
    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    public static string Line(IReadOnlyList<(DateTimeOffset At, decimal Value)> points, ThresholdResponse? threshold,
        string color, int width = 250, int height = 110)
    {
        const int left = 26, right = 8, top = 8, bottom = 16;
        var plotW = width - left - right;
        var plotH = height - top - bottom;
        var svg = new StringBuilder();
        svg.Append(Invariant, $"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{width}\" height=\"{height}\" viewBox=\"0 0 {width} {height}\">");

        if (points.Count < 2)
        {
            svg.Append(Invariant, $"<text x=\"{width / 2}\" y=\"{height / 2}\" text-anchor=\"middle\" font-family=\"Arial\" font-size=\"8\" fill=\"{ReportTheme.Faint}\">Not enough data</text></svg>");
            return svg.ToString();
        }

        // Y domain spans the data and the safe band, with breathing room.
        var values = points.Select(p => (double)p.Value).ToList();
        if (threshold?.WarningLow is { } wl) values.Add((double)wl);
        if (threshold?.WarningHigh is { } wh) values.Add((double)wh);
        var min = values.Min();
        var max = values.Max();
        var pad = Math.Max((max - min) * 0.12, 0.5);
        min -= pad;
        max += pad;

        var t0 = points[0].At.ToUnixTimeSeconds();
        var t1 = Math.Max(points[^1].At.ToUnixTimeSeconds(), t0 + 1);
        double X(DateTimeOffset at) => left + (at.ToUnixTimeSeconds() - t0) / (double)(t1 - t0) * plotW;
        double Y(double v) => top + (1 - (v - min) / (max - min)) * plotH;

        // Safe band
        if (threshold is not null)
        {
            var bandTop = Y(threshold.WarningHigh is { } hi ? (double)hi : max);
            var bandBottom = Y(threshold.WarningLow is { } lo ? (double)lo : min);
            svg.Append(Invariant, $"<rect x=\"{left}\" y=\"{bandTop:0.##}\" width=\"{plotW}\" height=\"{Math.Max(bandBottom - bandTop, 0):0.##}\" fill=\"{ReportTheme.Nominal}\" fill-opacity=\"0.08\"/>");
        }

        // Gridlines + labels
        for (var i = 0; i <= 3; i++)
        {
            var v = min + (max - min) * i / 3;
            var y = Y(v);
            svg.Append(Invariant, $"<line x1=\"{left}\" x2=\"{width - right}\" y1=\"{y:0.##}\" y2=\"{y:0.##}\" stroke=\"{ReportTheme.Line}\" stroke-width=\"0.6\"/>");
            svg.Append(Invariant, $"<text x=\"{left - 4}\" y=\"{y + 2.5:0.##}\" text-anchor=\"end\" font-family=\"Arial\" font-size=\"6.5\" fill=\"{ReportTheme.Faint}\">{v:0.#}</text>");
        }

        // Time labels (start / end)
        svg.Append(Invariant, $"<text x=\"{left}\" y=\"{height - 4}\" font-family=\"Arial\" font-size=\"6.5\" fill=\"{ReportTheme.Faint}\">{points[0].At.UtcDateTime:dd MMM HH:mm}</text>");
        svg.Append(Invariant, $"<text x=\"{width - right}\" y=\"{height - 4}\" text-anchor=\"end\" font-family=\"Arial\" font-size=\"6.5\" fill=\"{ReportTheme.Faint}\">{points[^1].At.UtcDateTime:dd MMM HH:mm} UTC</text>");

        // Area + line
        var path = new StringBuilder();
        for (var i = 0; i < points.Count; i++)
        {
            path.Append(Invariant, $"{(i == 0 ? 'M' : 'L')}{X(points[i].At):0.##},{Y((double)points[i].Value):0.##} ");
        }
        var baseline = top + plotH;
        svg.Append(Invariant, $"<path d=\"{path}L{X(points[^1].At):0.##},{baseline} L{X(points[0].At):0.##},{baseline} Z\" fill=\"{color}\" fill-opacity=\"0.10\"/>");
        svg.Append(Invariant, $"<path d=\"{path}\" fill=\"none\" stroke=\"{color}\" stroke-width=\"1.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>");

        var last = points[^1];
        svg.Append(Invariant, $"<circle cx=\"{X(last.At):0.##}\" cy=\"{Y((double)last.Value):0.##}\" r=\"2.2\" fill=\"{color}\"/>");
        svg.Append("</svg>");
        return svg.ToString();
    }
}
