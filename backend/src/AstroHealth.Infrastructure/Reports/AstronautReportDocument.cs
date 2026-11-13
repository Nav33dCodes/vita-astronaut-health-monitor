using AstroHealth.Application.Hazards;
using AstroHealth.Application.Reports;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Vitals;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using static AstroHealth.Infrastructure.Reports.PdfKit;
using static AstroHealth.Infrastructure.Reports.ReportTheme;

namespace AstroHealth.Infrastructure.Reports;

/// <summary>
/// Crew medical report for one person: status and early warning, latest vitals, the five hazards
/// (radiation budget, sleep), trends, statistics, early-warning breakdown and alert history.
/// </summary>
internal sealed class AstronautReportDocument(AstronautReport report) : IDocument
{
    private const string Title = "Crew medical report";
    private readonly Dictionary<VitalMetric, ThresholdResponse> _thresholds = report.Thresholds.ToDictionary(t => t.Metric);

    private string Name => $"{report.Astronaut.FirstName} {report.Astronaut.LastName}";

    public DocumentMetadata GetMetadata() => new()
    {
        Title = $"{Brand} {Title.ToLowerInvariant()}: {Name}",
        Author = Brand,
        Subject = "Crew medical summary",
        CreationDate = report.GeneratedAtUtc
    };

    public void Compose(IDocumentContainer container) => container.Page(page =>
    {
        Page(page);
        page.Header().SkipOnce().Element(c => RunningHeader(c, $"{Title} · {Name}"));

        page.Content().Column(column =>
        {
            var a = report.Astronaut;
            var section = 0;

            column.Item().Element(c => TitleBlock(c, Title, Name,
                $"{Humanize(a.Role)} · {a.Agency} · {a.MissionName ?? "Unassigned"} · age {a.Age}",
                [
                    ("Report ID", $"MED-{a.LastName.ToUpperInvariant()}-{report.GeneratedAtUtc.UtcDateTime:yyyyMMdd-HHmm}"),
                    ("Generated", Utc(report.GeneratedAtUtc)),
                    ("Period", $"Last {report.WindowHours} h · {report.Stats.ReadingCount:N0} readings"),
                    ("Classification", Classification)
                ]));

            column.Item().PaddingTop(12).Element(StatusStrip);

            Section(column, ++section, "Latest vitals",
                a.LatestReading is { } r ? $"recorded {Utc(r.RecordedAtUtc)}" : null, LatestVitals);

            if (report.Hazards is { } hazards)
            {
                Section(column, ++section, "Five hazards of spaceflight", "NASA Human Research Program", c => HazardsTable(c, hazards));
                column.Item().PaddingTop(8).Element(c => RadiationAndSleep(c, hazards));
            }

            Section(column, ++section, "Trends", $"last {report.WindowHours} h · shaded band is the safe range", Charts);

            Section(column, ++section, "Statistics", $"last {report.WindowHours} h", StatisticsTable);

            Section(column, ++section, "Early warning assessment", "adapted NEWS2 · trends over the last 60 min", EarlyWarning);

            Section(column, ++section, "Alert history", "most recent 25", AlertHistory);
        });

        page.Footer().Element(c => Footer(c, Title));
    });

    /// <summary>Health status, early warning score and open alerts, side by side.</summary>
    private void StatusStrip(IContainer container)
    {
        var a = report.Astronaut;
        var assessment = report.Assessment;
        var riskTone = assessment.Risk is { } risk ? ToneOf(risk) : Tone.Neutral;

        container.Row(row =>
        {
            row.Spacing(8);
            row.RelativeItem().Element(c => Card(c).Column(column =>
            {
                column.Item().Text("Health status").FontSize(7).Medium().FontColor(C(Muted));
                column.Item().PaddingTop(5).Element(p => Pill(p, ReportHazards.StatusLabel(a.HealthStatus), ToneOf(a.HealthStatus)));
                column.Item().PaddingTop(4).Text("Most severe open alert").FontSize(6.8f).FontColor(C(Muted));
            }));
            row.RelativeItem().Element(c => Kpi(c, "Early warning score",
                assessment.Score is { } score ? $"{score} / {EarlyWarningScore.MaxScore}" : "—",
                riskTone == Tone.Nominal ? Tone.Neutral : riskTone,
                assessment.Risk is { } rk ? $"{Humanize(rk)} risk" : "Not enough data"));
            row.RelativeItem().Element(c => Kpi(c, "Open alerts", a.OpenAlerts.ToString(),
                a.OpenAlerts > 0 ? Tone.Caution : Tone.Neutral, a.OpenAlerts == 0 ? "none" : "see alert history"));
            row.RelativeItem().Element(c => Kpi(c, "Readings analysed", report.Stats.ReadingCount.ToString("N0"), Tone.Neutral,
                $"last {report.WindowHours} h"));
        });
    }

    private void LatestVitals(IContainer container)
    {
        if (report.Astronaut.LatestReading is not { } latest)
        {
            container.Element(c => Note(c, "No vitals have been recorded for this crew member yet."));
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
                var flagged = tone is Tone.Caution or Tone.Critical;
                var noRate = t.Metric == VitalMetric.RadiationDose && latest.RadiationDoseRateMsvPerDay is null;

                table.Cell().Padding(3).Element(c => Card(c, flagged ? Palette(tone).Fg : null).Column(column =>
                {
                    column.Item().Text(t.Label).FontSize(7).Medium().FontColor(C(Muted));
                    column.Item().PaddingTop(2).Text(text =>
                    {
                        text.Span(noRate ? "—" : Number(value, t.Metric == VitalMetric.RadiationDose ? 2 : 1)).FontSize(15).SemiBold()
                            .FontColor(C(flagged ? Palette(tone).Fg : Ink));
                        text.Span(" " + DisplayUnit(t.Unit)).FontSize(7).FontColor(C(Muted));
                    });
                    column.Item().Text($"Safe {SafeRange(t)}").FontSize(6.8f).FontColor(C(Faint));
                }));
            }
        });
    }

    private static void HazardsTable(IContainer container, CrewHazardsResponse hazards)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn(2.3f);
                columns.RelativeColumn(1.1f);
                columns.RelativeColumn(5.4f);
            });

            table.Header(header =>
            {
                foreach (var title in new[] { "Hazard", "Status", "Assessment" })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            foreach (var hazard in ReportHazards.Order)
            {
                var h = hazards.Hazards.FirstOrDefault(x => x.Hazard == hazard);
                IContainer Cell() => BodyCell(table.Cell(), false);

                Cell().Text(ReportHazards.Label(hazard)).SemiBold();
                Cell().Element(c => Pill(c, ReportHazards.StatusLabel(h?.Status ?? HealthStatus.Unknown), ReportHazards.ToneOf(h?.Status ?? HealthStatus.Unknown)));
                Cell().Column(c =>
                {
                    c.Item().Text(h?.Headline ?? "No data");
                    if (h?.Detail is { } detail)
                    {
                        c.Item().Text(detail).FontSize(7.2f).FontColor(C(h.Status is HealthStatus.Caution or HealthStatus.Critical ? Palette(ToneOf(h.Status)).Fg : Muted));
                    }
                });
            }
        });
    }

    /// <summary>Radiation budget against the career limit, and the last week of sleep.</summary>
    private void RadiationAndSleep(IContainer container, CrewHazardsResponse hazards)
    {
        var r = hazards.Radiation;
        var wellness = report.Wellness;

        container.Row(row =>
        {
            row.Spacing(8);

            row.RelativeItem().Element(c => Card(c).Column(column =>
            {
                column.Item().Text("Radiation budget").FontSize(7).Medium().FontColor(C(Muted));
                column.Item().PaddingTop(3).Text(text =>
                {
                    text.Span($"{r.MissionDoseMsv:0.0}").FontSize(17).SemiBold();
                    text.Span($" mSv this mission").FontSize(7.5f).FontColor(C(Muted));
                });
                column.Item().PaddingTop(6).Element(b => Bar(b, r.PercentOfLimit,
                    r.PercentOfLimit >= 100 ? Tone.Critical : r.PercentOfLimit >= 80 ? Tone.Caution : Tone.Neutral, 80));
                column.Item().PaddingTop(4).Row(line =>
                {
                    line.RelativeItem().Text($"{r.PercentOfLimit:0.#}% of the {r.CareerLimitMsv:0} mSv career limit").FontSize(7).FontColor(C(Muted));
                });
                column.Item().PaddingTop(2).Text(r.CurrentRateMsvPerDay is { } rate
                        ? $"Current rate {rate:0.00} mSv/day{(r.DaysToLimitAtCurrentRate is { } days ? $" · limit in {days:N0} days at this rate" : "")}"
                        : "No dosimeter rate reported yet")
                    .FontSize(7).FontColor(C(Muted));
            }));

            row.RelativeItem().Element(c => Card(c).Column(column =>
            {
                column.Item().Row(head =>
                {
                    head.RelativeItem().Text("Sleep, last 7 nights").FontSize(7).Medium().FontColor(C(Muted));
                    if (wellness?.AverageSleepHours is { } avg)
                    {
                        head.AutoItem().Text($"{avg:0.0} h avg, last 3 nights").FontSize(7)
                            .FontColor(C(avg < 5 ? Critical : avg < 6 ? Caution : Muted));
                    }
                });
                column.Item().PaddingTop(5).Height(62)
                    .Svg(SvgImage.FromText(ReportHazards.SleepChart(wellness?.Entries ?? [])));
                var checkIn = wellness?.Entries.FirstOrDefault(e => e.Mood is not null);
                column.Item().PaddingTop(3).Text(checkIn is null
                        ? "No check-in this week"
                        : $"Latest check-in {checkIn.Date:dd MMM}: mood {checkIn.Mood}/5 · stress {checkIn.Stress}/5 · workload {checkIn.Workload}/5")
                    .FontSize(7).FontColor(C(Muted));
            }));
        });
    }

    private void Charts(IContainer container)
    {
        (VitalMetric Metric, Func<VitalSeriesPoint, decimal> Value)[] charts =
        [
            (VitalMetric.HeartRate, p => p.HeartRateBpm),
            (VitalMetric.OxygenSaturation, p => p.OxygenSaturationPct),
            (VitalMetric.BodyTemperature, p => p.BodyTemperatureC),
            (VitalMetric.RespiratoryRate, p => p.RespiratoryRatePerMin)
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

                table.Cell().Padding(3).Element(c => Card(c).Column(column =>
                {
                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Text(threshold?.Label ?? Humanize(chart.Metric)).FontSize(7.5f).SemiBold();
                        row.AutoItem().Text(threshold is null ? "" : DisplayUnit(threshold.Unit)).FontSize(7).FontColor(C(Faint));
                    });
                    column.Item().PaddingTop(4).Height(100).Svg(SvgImage.FromText(ChartSvg.Line(points, threshold, Accent)));
                }));
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
                foreach (var title in new[] { "Metric", "Min", "Average", "Max", "Latest", "Safe range" })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            foreach (var m in report.Stats.Metrics)
            {
                var t = _thresholds.GetValueOrDefault(m.Metric);
                var decimals = m.Metric == VitalMetric.RadiationDose ? 2 : 1;
                IContainer Cell() => BodyCell(table.Cell(), false);
                Tone Flag(decimal v)
                {
                    var tone = ToneOf(v, t);
                    return tone == Tone.Nominal ? Tone.Neutral : tone; // only out-of-range values take a colour
                }

                Cell().Text(t?.Label ?? Humanize(m.Metric)).SemiBold();
                Cell().Element(c => Value(c, Number(m.Min, decimals), Flag(m.Min)));
                Cell().Element(c => Value(c, Number(m.Average, decimals), Flag(m.Average)));
                Cell().Element(c => Value(c, Number(m.Max, decimals), Flag(m.Max)));
                Cell().Element(c => Value(c, Number(m.Latest, decimals), Flag(m.Latest), true));
                Cell().Text(t is null ? "—" : SafeRange(t)).FontSize(7.2f).FontColor(C(Muted));
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
            row.Spacing(8);

            row.RelativeItem().Element(c => Card(c).Column(column =>
            {
                column.Item().PaddingBottom(4).Text("Score breakdown").FontSize(7).Medium().FontColor(C(Muted));
                foreach (var component in assessment.Components)
                {
                    var color = component.Points >= 3 ? Critical : component.Points >= 1 ? Caution : Nominal;
                    column.Item().PaddingVertical(2).Row(line =>
                    {
                        line.RelativeItem().Text(_thresholds.GetValueOrDefault(component.Metric)?.Label ?? Humanize(component.Metric));
                        line.ConstantItem(42).AlignRight().Text(Number(component.Value)).FontColor(C(Muted));
                        line.ConstantItem(10);
                        for (var p = 1; p <= 3; p++)
                        {
                            line.ConstantItem(12).PaddingHorizontal(1).AlignMiddle().Height(4)
                                .Background(C(p <= component.Points ? color : Raised)).CornerRadius(2);
                        }
                        line.ConstantItem(24).AlignRight().Text($"{component.Points} pt").FontSize(7).FontColor(C(component.Points > 0 ? color : Faint));
                    });
                }
            }));

            row.RelativeItem().Element(c => Card(c).Column(column =>
            {
                column.Item().PaddingBottom(4).Text("Trends").FontSize(7).Medium().FontColor(C(Muted));
                if (assessment.Trends.Count == 0)
                {
                    column.Item().Text("All vitals stable. No sustained deterioration detected.").FontColor(C(Muted));
                }
                foreach (var trend in assessment.Trends)
                {
                    var watch = trend.Severity == TrendSeverity.Watch;
                    column.Item().PaddingVertical(2).Background(C(watch ? CautionSoft : Panel)).CornerRadius(4).Padding(5)
                        .Text(trend.Message).FontSize(7.5f).FontColor(C(watch ? Caution : Ink));
                }
            }));
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
                columns.RelativeColumn(1.4f);
                columns.RelativeColumn(4.4f);
                columns.RelativeColumn(1.1f);
                columns.RelativeColumn(1.3f);
                columns.RelativeColumn(0.8f);
            });

            table.Header(header =>
            {
                foreach (var title in new[] { "Raised (UTC)", "Finding", "Severity", "Status", "Escalation" })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            foreach (var alert in report.Alerts)
            {
                IContainer Cell() => BodyCell(table.Cell(), false);

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
