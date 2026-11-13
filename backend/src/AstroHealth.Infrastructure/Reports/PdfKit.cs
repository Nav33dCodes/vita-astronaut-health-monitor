using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using static AstroHealth.Infrastructure.Reports.ReportTheme;

namespace AstroHealth.Infrastructure.Reports;

/// <summary>
/// The PDF design system: the same minimal language as the web app (neutral surfaces, hairlines,
/// one indigo accent, colour only for clinical state) and a type-only VITA wordmark.
/// </summary>
internal static class PdfKit
{
    public static Color C(string hex) => Color.FromHex(hex);

    private static readonly Color White = Color.FromHex("#FFFFFF");

    public static void Page(PageDescriptor page)
    {
        page.Size(PageSizes.A4);
        page.MarginHorizontal(40);
        page.MarginTop(30);
        page.MarginBottom(26);
        page.PageColor(White);
        page.DefaultTextStyle(style => style.FontFamily(Fonts.Lato).FontSize(8.5f).FontColor(C(Ink)).LineHeight(1.35f));
    }

    /// <summary>"VITA" with the indigo full stop, as in the app's sidebar.</summary>
    public static void Wordmark(IContainer container, float size = 13)
    {
        container.Text(text =>
        {
            text.Span(Brand).FontSize(size).Bold().LetterSpacing(0.32f).FontColor(C(Ink));
            text.Span(".").FontSize(size).Bold().FontColor(C(Accent));
        });
    }

    /// <summary>
    /// First-page title block: wordmark and document type, the title, and a metadata strip
    /// (report id, generated, scope, classification).
    /// </summary>
    public static void TitleBlock(
        IContainer container, string documentType, string title, string subtitle, IReadOnlyList<(string Label, string Value)> meta)
    {
        container.Column(column =>
        {
            column.Item().Row(row =>
            {
                row.RelativeItem().Element(c => Wordmark(c));
                row.AutoItem().AlignMiddle().Text(documentType).FontSize(8).Medium().FontColor(C(Muted));
            });

            column.Item().PaddingTop(22).Text(title).FontSize(21).SemiBold().LetterSpacing(-0.01f).FontColor(C(Ink));
            column.Item().PaddingTop(3).Text(subtitle).FontSize(9.5f).FontColor(C(Muted));

            column.Item().PaddingTop(16).BorderTop(0.75f).BorderBottom(0.75f).BorderColor(C(Line)).PaddingVertical(9).Row(row =>
            {
                foreach (var (label, value) in meta)
                {
                    row.RelativeItem().Column(cell =>
                    {
                        cell.Item().Text(label).FontSize(6.8f).FontColor(C(Faint));
                        cell.Item().PaddingTop(1.5f).Text(value).FontSize(8).Medium().FontColor(C(Ink));
                    });
                }
            });
        });
    }

    /// <summary>Slim header repeated from page two onwards.</summary>
    public static void RunningHeader(IContainer container, string title)
    {
        container.PaddingBottom(14).Column(column =>
        {
            column.Item().Row(row =>
            {
                row.RelativeItem().AlignMiddle().Element(c => Wordmark(c, 10));
                row.AutoItem().AlignMiddle().Text(title).FontSize(7.5f).FontColor(C(Muted));
            });
            column.Item().PaddingTop(7).LineHorizontal(0.75f).LineColor(C(Line));
        });
    }

    public static void Footer(IContainer container, string title)
    {
        container.PaddingTop(10).BorderTop(0.75f).BorderColor(C(Line)).PaddingTop(6).Row(row =>
        {
            row.RelativeItem().Text(text =>
            {
                text.DefaultTextStyle(style => style.FontSize(6.8f).FontColor(C(Faint)));
                text.Span($"{Brand} · {title} · ").FontColor(C(Muted));
                text.Span($"{Classification}. {Disclaimer}.");
            });
            row.AutoItem().Text(text =>
            {
                text.DefaultTextStyle(style => style.FontSize(6.8f).FontColor(C(Muted)));
                text.CurrentPageNumber();
                text.Span(" / ");
                text.TotalPages();
            });
        });
    }

    /// <summary>Numbered section heading: "01  Crew status" with an optional right-aligned hint.</summary>
    public static void Section(IContainer container, int number, string title, string? hint = null)
    {
        container.PaddingTop(20).PaddingBottom(8).Row(row =>
        {
            row.ConstantItem(20).AlignBottom().Text(number.ToString("00")).FontSize(8).SemiBold().FontColor(C(Accent));
            row.RelativeItem().AlignBottom().Text(title).FontSize(11).SemiBold().FontColor(C(Ink));
            if (hint is not null)
            {
                row.AutoItem().AlignBottom().Text(hint).FontSize(7.3f).FontColor(C(Muted));
            }
        });
    }

    /// <summary>Card with a hairline border; the shared surface of tiles and panels.</summary>
    public static IContainer Card(IContainer container, string? border = null) =>
        container.Border(0.75f).BorderColor(C(border ?? Line)).CornerRadius(6).Padding(10);

    /// <summary>KPI tile: label, large value, detail line.</summary>
    public static void Kpi(IContainer container, string label, string value, Tone tone = Tone.Neutral, string? detail = null)
    {
        var valueColor = tone == Tone.Neutral ? Ink : Palette(tone).Fg;
        Card(container).Column(column =>
        {
            column.Item().Text(label).FontSize(7).Medium().FontColor(C(Muted));
            column.Item().PaddingTop(3).Text(value).FontSize(17).SemiBold().LetterSpacing(-0.01f).FontColor(C(valueColor));
            column.Item().Text(detail ?? " ").FontSize(6.8f).FontColor(C(Muted));
        });
    }

    /// <summary>Status chip: tinted background, coloured dot and label.</summary>
    public static void Pill(IContainer container, string text, Tone tone)
    {
        var (fg, bg) = Palette(tone);
        container.AlignLeft().AlignMiddle().Background(C(tone == Tone.Neutral ? Raised : bg)).CornerRadius(3)
            .PaddingHorizontal(4.5f).PaddingVertical(1.5f).Row(row =>
            {
                row.AutoItem().AlignMiddle().PaddingRight(3).Width(3.5f).Height(3.5f).Background(C(fg)).CornerRadius(1.75f);
                row.AutoItem().Text(text).FontSize(6.6f).Medium().FontColor(C(fg));
            });
    }

    /// <summary>Table header cell: muted label above a firm hairline (no filled bar).</summary>
    public static IContainer HeadCell(IContainer container) =>
        container.BorderBottom(0.9f).BorderColor(C(LineStrong)).PaddingVertical(5).PaddingHorizontal(4)
            .DefaultTextStyle(style => style.FontSize(6.8f).SemiBold().FontColor(C(Muted)));

    /// <summary>Table body cell separated by a light hairline. <paramref name="shaded"/> is kept for call sites; rows are not zebra-striped.</summary>
    public static IContainer BodyCell(IContainer container, bool shaded) =>
        container.BorderBottom(0.5f).BorderColor(C(Line)).PaddingVertical(5).PaddingHorizontal(4).AlignMiddle();

    public static void Note(IContainer container, string text)
    {
        container.Background(C(Panel)).CornerRadius(6).Padding(10).Text(text).FontSize(8).FontColor(C(Muted));
    }

    /// <summary>Text coloured by tone (neutral → ink).</summary>
    public static void Value(IContainer container, string text, Tone tone, bool bold = false)
    {
        var descriptor = container.Text(text).FontColor(C(tone == Tone.Neutral ? Ink : Palette(tone).Fg));
        if (bold || tone is Tone.Caution or Tone.Critical)
        {
            descriptor.SemiBold();
        }
    }

    /// <summary>Horizontal progress bar with an optional marker (e.g. 80% caution line).</summary>
    public static void Bar(IContainer container, decimal percent, Tone tone, decimal? marker = null)
    {
        var fill = (float)Math.Clamp(percent, 0.8m, 100m);
        var color = tone == Tone.Neutral ? Accent : Palette(tone).Fg;
        container.Height(5).Layers(layers =>
        {
            layers.PrimaryLayer().Background(C(Raised)).CornerRadius(2.5f);
            layers.Layer().Row(row =>
            {
                row.RelativeItem(fill).Background(C(color)).CornerRadius(2.5f);
                if (fill < 100) row.RelativeItem(100 - fill);
            });
            if (marker is { } m)
            {
                layers.Layer().Row(row =>
                {
                    row.RelativeItem((float)m);
                    row.ConstantItem(0.75f).Background(C(LineStrong));
                    row.RelativeItem(100 - (float)m);
                });
            }
        });
    }
}
