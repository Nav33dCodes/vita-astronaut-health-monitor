using AstroHealth.Application.Reports;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Vitals;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using static AstroHealth.Infrastructure.Reports.PdfKit;
using static AstroHealth.Infrastructure.Reports.ReportTheme;

namespace AstroHealth.Infrastructure.Reports;

/// <summary>Per-astronaut medical summary: identity, latest vitals, trend charts, statistics, early warning, alerts.</summary>
internal sealed class AstronautReportDocument(AstronautReport report) : IDocument
{
    private readonly Dictionary<VitalMetric, ThresholdResponse> _thresholds = report.Thresholds.ToDictionary(t => t.Metric);

    public DocumentMetadata GetMetadata() => new()
    {
        Title = $"{Brand} medical report — {report.Astronaut.FirstName} {report.Astronaut.LastName}",
        Author = Brand,
        Subject = "Crew medical summary",
        CreationDate = report.GeneratedAtUtc
    };

    public void Compose(IDocumentContainer container) => container.Page(page =>
    {
        Page(page);
        page.Header().Element(c => Header(c, "Crew medical report",
            $"Last {report.WindowHours} hours · {report.Stats.ReadingCount:N0} readings analysed", report.GeneratedAtUtc));

        page.Content().PaddingTop(14).Column(column =>
        {
            column.Item().Element(IdentityCard);

            column.Item().Element(c => SectionTitle(c, "Latest vitals",
                report.Astronaut.LatestReading is { } r ? $"recorded {Utc(r.RecordedAtUtc)}" : null));
            column.Item().Element(LatestVitals);

            column.Item().Element(c => SectionTitle(c, "Trends", $"last {report.WindowHours}h · shaded band = safe range"));
            column.Item().Element(Charts);

            column.Item().Element(c => SectionTitle(c, "Statistics", $"last {report.WindowHours}h"));
            column.Item().Element(StatisticsTable);

            column.Item().Element(c => SectionTitle(c, "Early warning assessment", "adapted NEWS2 · trends over the last 60 min"));
            column.Item().Element(EarlyWarning);

            column.Item().Element(c => SectionTitle(c, "Alert history", "most recent 25"));
            column.Item().Element(AlertHistory);
        });

        page.Footer().Element(Footer);
    });

    private void IdentityCard(IContainer container)
    {
        var a = report.Astronaut;
        var assessment = report.Assessment;

        container.Background(C(Panel)).Border(0.75f).BorderColor(C(Line)).CornerRadius(8).Padding(12).Row(row =>
        {
            row.RelativeItem().Column(column =>
            {
                column.Item().Text($"{a.FirstName} {a.LastName}").FontSize(18).Bold();
                column.Item().PaddingTop(2).Text($"{Humanize(a.Role)} · {a.Agency} · {a.MissionName ?? "Unassigned"}")
                    .FontSize(8.5f).FontColor(C(Muted));
                column.Item().Text($"Age {a.Age} · born {a.DateOfBirth:dd MMM yyyy} · {a.OpenAlerts} open alert{(a.OpenAlerts == 1 ? "" : "s")}")
                    .FontSize(8).FontColor(C(Muted));
            });

            row.ConstantItem(92).AlignMiddle().Column(column =>
            {
                column.Item().AlignRight().Text("HEALTH STATUS").FontSize(6).SemiBold().LetterSpacing(0.1f).FontColor(C(Muted));
                column.Item().PaddingTop(3).AlignRight().Element(c => Pill(c, a.HealthStatus.ToString(), ToneOf(a.HealthStatus)));
            });

            row.ConstantItem(12);

            row.ConstantItem(96).AlignMiddle().Background(assessment.Risk is { } risk ? C(Palette(ToneOf(risk)).Bg) : C(Panel))
                .CornerRadius(6).Padding(7).Column(column =>
                {
                    column.Item().AlignCenter().Text("EARLY WARNING").FontSize(6).SemiBold().LetterSpacing(0.1f).FontColor(C(Muted));
                    column.Item().AlignCenter().Text(text =>
                    {
                        var tone = assessment.Risk is { } r ? ToneOf(r) : Tone.Neutral;
                        text.Span(assessment.Score?.ToString() ?? "—").FontSize(20).Bold()
                            .FontColor(C(tone == Tone.Neutral ? Ink : Palette(tone).Fg));
                        text.Span($" / {EarlyWarningScore.MaxScore}").FontSize(8).FontColor(C(Muted));
                    });
                    column.Item().AlignCenter().Text(assessment.Risk is { } rk ? $"{Humanize(rk)} risk" : "No data")
                        .FontSize(7).FontColor(C(Muted));
                });
        });
    }

    private void LatestVitals(IContainer container)
    {
        if (report.Astronaut.LatestReading is not { } latest)
        {
            container.Element(c => Note(c, "No vitals have been recorded for this astronaut yet."));
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                for (var i = 0; i < 4; i++) columns.RelativeColumn();
            });

            foreach (var t in report.Thresholds)
            {
                var value = ValueOf(latest, t.Metric);
                var tone = ToneOf(value, t);
                table.Cell().Padding(3).Background(C(tone == Tone.Critical ? CriticalSoft : Panel))
                    .Border(0.75f).BorderColor(C(tone == Tone.Critical ? Critical : Line)).CornerRadius(6).Padding(8).Column(column =>
                    {
                        column.Item().Text(t.Label.ToUpperInvariant()).FontSize(6).SemiBold().LetterSpacing(0.08f).FontColor(C(Muted));
                        column.Item().PaddingTop(2).Text(text =>
                        {
                            text.Span(Number(value, t.Metric == VitalMetric.RadiationDose ? 4 : 1)).FontSize(15).Bold()
                                .FontColor(C(tone == Tone.Neutral ? Ink : Palette(tone).Fg));
                            text.Span(" " + DisplayUnit(t.Unit)).FontSize(7).FontColor(C(Muted));
                        });
                        column.Item().Text($"safe {SafeRange(t)}").FontSize(6.5f).FontColor(C(Faint));
                    });
            }
        });
    }

    private void Charts(IContainer container)
    {
        (VitalMetric Metric, string Color, Func<VitalSeriesPoint, decimal> Value)[] charts =
        [
            (VitalMetric.HeartRate, Accent, p => p.HeartRateBpm),
            (VitalMetric.OxygenSaturation, Violet, p => p.OxygenSaturationPct),
            (VitalMetric.BodyTemperature, Caution, p => p.BodyTemperatureC),
            (VitalMetric.RespiratoryRate, Nominal, p => p.RespiratoryRatePerMin)
        ];

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn();
                columns.RelativeColumn();
            });

            foreach (var chart in charts)
            {
                var threshold = _thresholds.GetValueOrDefault(chart.Metric);
                var points = report.Series.Points.Select(p => (p.RecordedAtUtc, chart.Value(p))).ToList();

                table.Cell().Padding(3).Border(0.75f).BorderColor(C(Line)).CornerRadius(6).Padding(8).Column(column =>
                {
                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Text(threshold?.Label ?? Humanize(chart.Metric)).FontSize(7.5f).SemiBold();
                        row.AutoItem().Text(threshold is null ? "" : DisplayUnit(threshold.Unit)).FontSize(7).FontColor(C(Faint));
                    });
                    column.Item().PaddingTop(4).Height(105).Svg(SvgImage.FromText(ChartSvg.Line(points, threshold, chart.Color)));
                });
            }
        });
    }

    private void StatisticsTable(IContainer container)
    {
        if (report.Stats.ReadingCount == 0)
        {
            container.Element(c => Note(c, $"No readings in the last {report.WindowHours} hours."));
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn(2.2f);
                for (var i = 0; i < 4; i++) columns.RelativeColumn();
                columns.RelativeColumn(1.6f);
            });

            table.Header(header =>
            {
                foreach (var title in new[] { "METRIC", "MIN", "AVERAGE", "MAX", "LATEST", "SAFE RANGE" })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            var rows = report.Stats.Metrics.ToList();
            for (var i = 0; i < rows.Count; i++)
            {
                var m = rows[i];
                var t = _thresholds.GetValueOrDefault(m.Metric);
                var decimals = m.Metric == VitalMetric.RadiationDose ? 4 : 1;
                IContainer Cell() => BodyCell(table.Cell(), i % 2 == 1);

                Cell().Text(t?.Label ?? Humanize(m.Metric)).SemiBold();
                Cell().Element(c => Value(c, Number(m.Min, decimals), ToneOf(m.Min, t)));
                Cell().Element(c => Value(c, Number(m.Average, decimals), ToneOf(m.Average, t)));
                Cell().Element(c => Value(c, Number(m.Max, decimals), ToneOf(m.Max, t)));
                Cell().Element(c => Value(c, Number(m.Latest, decimals), ToneOf(m.Latest, t), true));
                Cell().Text(t is null ? "—" : SafeRange(t)).FontSize(7).FontColor(C(Muted));
            }
        });
    }

    private void EarlyWarning(IContainer container)
    {
        var assessment = report.Assessment;
        if (assessment.Score is null)
        {
            container.Element(c => Note(c, "Not enough data to compute an early warning score."));
            return;
        }

        container.Row(row =>
        {
            row.Spacing(10);

            row.RelativeItem().Border(0.75f).BorderColor(C(Line)).CornerRadius(6).Padding(9).Column(column =>
            {
                column.Item().PaddingBottom(4).Text("SCORE BREAKDOWN").FontSize(6).SemiBold().LetterSpacing(0.1f).FontColor(C(Muted));
                foreach (var component in assessment.Components)
                {
                    column.Item().PaddingVertical(2).Row(line =>
                    {
                        line.RelativeItem().Text(_thresholds.GetValueOrDefault(component.Metric)?.Label ?? Humanize(component.Metric));
                        line.ConstantItem(42).AlignRight().Text(Number(component.Value)).FontColor(C(Muted));
                        line.ConstantItem(8);
                        line.ConstantItem(22).AlignRight().Text($"{component.Points} pt")
                            .FontSize(7).SemiBold().FontColor(C(component.Points >= 3 ? Critical : component.Points >= 1 ? Caution : Nominal));
                        line.ConstantItem(6);
                        for (var p = 1; p <= 3; p++)
                        {
                            var filled = p <= component.Points;
                            var color = component.Points >= 3 ? Critical : component.Points >= 1 ? Caution : Nominal;
                            line.ConstantItem(10).PaddingHorizontal(1).AlignMiddle().Height(5)
                                .Background(C(filled ? color : Line)).CornerRadius(1.5f);
                        }
                    });
                }
            });

            row.RelativeItem().Border(0.75f).BorderColor(C(Line)).CornerRadius(6).Padding(9).Column(column =>
            {
                column.Item().PaddingBottom(4).Text("TRENDS").FontSize(6).SemiBold().LetterSpacing(0.1f).FontColor(C(Muted));
                if (assessment.Trends.Count == 0)
                {
                    column.Item().Text("All vitals stable — no sustained deterioration detected.").FontColor(C(Muted));
                }
                foreach (var trend in assessment.Trends)
                {
                    var tone = trend.Severity == TrendSeverity.Watch ? Tone.Caution : Tone.Neutral;
                    column.Item().PaddingVertical(2).Background(C(Palette(tone).Bg)).CornerRadius(4).Padding(5)
                        .Text(trend.Message).FontSize(7.5f).FontColor(C(tone == Tone.Caution ? Caution : Ink));
                }
            });
        });
    }

    private void AlertHistory(IContainer container)
    {
        if (report.Alerts.Count == 0)
        {
            container.Element(c => Note(c, "No alerts on record."));
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn(1.5f);
                columns.RelativeColumn(4.4f);
                columns.RelativeColumn(1.1f);
                columns.RelativeColumn(1.3f);
                columns.RelativeColumn(0.9f);
            });

            table.Header(header =>
            {
                foreach (var title in new[] { "RAISED (UTC)", "FINDING", "SEVERITY", "STATUS", "ESC." })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            for (var i = 0; i < report.Alerts.Count; i++)
            {
                var alert = report.Alerts[i];
                IContainer Cell() => BodyCell(table.Cell(), i % 2 == 1);

                Cell().Text(Short(alert.RaisedAtUtc)).FontSize(7.5f).FontColor(C(Muted));
                Cell().Column(c =>
                {
                    c.Item().Text(alert.Message);
                    if (alert.ResolutionNote is { } note)
                    {
                        c.Item().Text($"Resolution: {note}").FontSize(7).Italic().FontColor(C(Muted));
                    }
                });
                Cell().Element(c => Pill(c, alert.Severity.ToString(), ToneOf(alert.Severity)));
                Cell().Element(c => Pill(c, alert.Status.ToString(), ToneOf(alert.Status)));
                Cell().Text(alert.EscalationLevel > 0 ? $"L{alert.EscalationLevel}" : "—")
                    .FontColor(C(alert.EscalationLevel > 0 ? Critical : Faint));
            }
        });
    }
}
