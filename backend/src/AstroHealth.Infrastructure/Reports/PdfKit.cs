using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using static AstroHealth.Infrastructure.Reports.ReportTheme;

namespace AstroHealth.Infrastructure.Reports;

/// <summary>Reusable QuestPDF building blocks — the "component library" of every PDF report.</summary>
internal static class PdfKit
{
    private static readonly Lazy<byte[]> LogoBytes = new(() =>
    {
        var assembly = typeof(PdfKit).Assembly;
        var name = assembly.GetManifestResourceNames().Single(n => n.EndsWith("logo-mark.png", StringComparison.Ordinal));
        using var stream = assembly.GetManifestResourceStream(name)!;
        using var memory = new MemoryStream();
        stream.CopyTo(memory);
        return memory.ToArray();
    });

    public static Color C(string hex) => Color.FromHex(hex);

    private static readonly Color White = Color.FromHex("#FFFFFF");

    public static void Page(PageDescriptor page)
    {
        page.Size(PageSizes.A4);
        page.MarginHorizontal(36);
        page.MarginVertical(28);
        page.PageColor(White);
        page.DefaultTextStyle(style => style.FontSize(8.5f).FontColor(C(Ink)).LineHeight(1.3f));
    }

    public static void Header(IContainer container, string title, string subtitle, DateTimeOffset generatedAt)
    {
        container.Column(column =>
        {
            column.Item().Row(row =>
            {
                row.ConstantItem(38).Height(26).AlignMiddle().Image(LogoBytes.Value).FitArea();
                row.ConstantItem(10);
                row.RelativeItem().AlignMiddle().Column(text =>
                {
                    text.Item().Text(line =>
                    {
                        line.Span(Brand).FontSize(15).Bold().LetterSpacing(0.18f).FontColor(C(Ink));
                        line.Span("   " + title).FontSize(11).SemiBold().FontColor(C(Muted));
                    });
                    text.Item().Text(subtitle).FontSize(8).FontColor(C(Muted));
                });
                row.AutoItem().AlignMiddle().Column(meta =>
                {
                    meta.Item().AlignRight().Text($"Generated {Utc(generatedAt)}").FontSize(7.5f).FontColor(C(Muted));
                    meta.Item().AlignRight().Text("CONFIDENTIAL · CREW MEDICAL DATA")
                        .FontSize(6).SemiBold().LetterSpacing(0.12f).FontColor(C(Faint));
                });
            });
            column.Item().PaddingTop(10).LineHorizontal(1.5f).LineColor(C(Accent));
        });
    }

    public static void Footer(IContainer container)
    {
        container.PaddingTop(10).BorderTop(0.5f).BorderColor(C(Line)).PaddingTop(6).Row(row =>
        {
            row.RelativeItem().Text($"{Brand} · {BrandFull} · {Disclaimer}").FontSize(6.5f).FontColor(C(Faint));
            row.AutoItem().Text(text =>
            {
                text.DefaultTextStyle(style => style.FontSize(6.5f).FontColor(C(Muted)));
                text.Span("Page ");
                text.CurrentPageNumber();
                text.Span(" of ");
                text.TotalPages();
            });
        });
    }

    public static void SectionTitle(IContainer container, string title, string? hint = null)
    {
        container.PaddingTop(16).PaddingBottom(7).Row(row =>
        {
            row.ConstantItem(3).Height(11).Background(C(Accent));
            row.ConstantItem(7);
            row.RelativeItem().AlignMiddle().Text(title.ToUpperInvariant())
                .FontSize(8).SemiBold().LetterSpacing(0.12f).FontColor(C(Ink));
            if (hint is not null)
            {
                row.AutoItem().AlignMiddle().Text(hint).FontSize(7).FontColor(C(Faint));
            }
        });
    }

    /// <summary>KPI tile: small caps label, large value, optional detail.</summary>
    public static void Kpi(IContainer container, string label, string value, Tone tone = Tone.Neutral, string? detail = null)
    {
        var valueColor = tone == Tone.Neutral ? Ink : Palette(tone).Fg;
        container.Background(C(Panel)).Border(0.75f).BorderColor(C(Line)).CornerRadius(6).Padding(9).Column(column =>
        {
            column.Item().Text(label.ToUpperInvariant()).FontSize(6).SemiBold().LetterSpacing(0.1f).FontColor(C(Muted));
            column.Item().PaddingTop(2).Text(value).FontSize(17).Bold().FontColor(C(valueColor));
            column.Item().Text(detail ?? " ").FontSize(6.5f).FontColor(C(Muted));
        });
    }

    /// <summary>Rounded status chip.</summary>
    public static void Pill(IContainer container, string text, Tone tone)
    {
        var (fg, bg) = Palette(tone);
        container.AlignLeft().AlignMiddle().Background(C(bg)).CornerRadius(3).PaddingHorizontal(5).PaddingVertical(1.5f)
            .Text(text).FontSize(6.5f).SemiBold().FontColor(C(fg));
    }

    public static IContainer HeadCell(IContainer container) =>
        container.Background(C(HeaderFill)).PaddingVertical(5).PaddingHorizontal(5)
            .DefaultTextStyle(style => style.FontSize(6.5f).SemiBold().LetterSpacing(0.05f).FontColor(White));

    public static IContainer BodyCell(IContainer container, bool shaded) =>
        container.Background(shaded ? C(Panel) : White).BorderBottom(0.5f).BorderColor(C(Line))
            .PaddingVertical(4.5f).PaddingHorizontal(5).AlignMiddle();

    public static void Note(IContainer container, string text)
    {
        container.Border(0.75f).BorderColor(C(Line)).CornerRadius(6).Padding(10)
            .AlignCenter().Text(text).FontSize(8).FontColor(C(Muted));
    }

    /// <summary>Text coloured by tone (neutral → ink).</summary>
    public static void Value(IContainer container, string text, Tone tone, bool bold = false)
    {
        var descriptor = container.Text(text).FontColor(C(tone == Tone.Neutral ? Ink : Palette(tone).Fg));
        if (bold)
        {
            descriptor.SemiBold();
        }
    }
}
