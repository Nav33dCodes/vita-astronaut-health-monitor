using AstroHealth.Application.Reports;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Vitals;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using static AstroHealth.Infrastructure.Reports.PdfKit;
using static AstroHealth.Infrastructure.Reports.ReportTheme;

namespace AstroHealth.Infrastructure.Reports;

/// <summary>Fleet-wide shift report: KPIs, every crew member's status and latest vitals, open alerts, missions.</summary>
internal sealed class FleetReportDocument(FleetReport report) : IDocument
{
    private const int MaxAlertRows = 25;

    public DocumentMetadata GetMetadata() => new()
    {
        Title = $"{Brand} fleet health report",
        Author = Brand,
        Subject = "Crew health — fleet overview",
        CreationDate = report.GeneratedAtUtc
    };

    public void Compose(IDocumentContainer container) => container.Page(page =>
    {
        Page(page);
        var summary = report.Summary;
        page.Header().Element(c => Header(c, "Fleet health report",
            $"{summary.ActiveMissions} mission{(summary.ActiveMissions == 1 ? "" : "s")} in flight · {summary.TotalCrew} crew monitored", report.GeneratedAtUtc));

        page.Content().PaddingTop(14).Column(column =>
        {
            column.Item().Row(row =>
            {
                row.Spacing(7);
                row.RelativeItem().Element(c => Kpi(c, "Crew", summary.TotalCrew.ToString(), Tone.Neutral, "monitored"));
                row.RelativeItem().Element(c => Kpi(c, "Critical", summary.CrewHealth.Critical.ToString(),
                    summary.CrewHealth.Critical > 0 ? Tone.Critical : Tone.Neutral, "crew members"));
                row.RelativeItem().Element(c => Kpi(c, "Caution", summary.CrewHealth.Caution.ToString(),
                    summary.CrewHealth.Caution > 0 ? Tone.Caution : Tone.Neutral, "crew members"));
                row.RelativeItem().Element(c => Kpi(c, "Open alerts", summary.OpenAlerts.ToString(),
                    summary.OpenCriticalAlerts > 0 ? Tone.Critical : summary.OpenAlerts > 0 ? Tone.Caution : Tone.Neutral,
                    $"{summary.OpenCriticalAlerts} critical"));
                row.RelativeItem().Element(c => Kpi(c, "Escalated", summary.EscalatedAlerts.ToString(),
                    summary.EscalatedAlerts > 0 ? Tone.Critical : Tone.Neutral, "unacknowledged"));
                row.RelativeItem().Element(c => Kpi(c, "Readings · 24h", summary.ReadingsLast24Hours.ToString("N0")));
            });

            column.Item().Element(c => SectionTitle(c, "Crew status", $"{report.Crew.Count} astronauts · sorted by severity"));
            column.Item().Element(CrewTable);

            column.Item().Element(c => SectionTitle(c, "Open alerts",
                report.OpenAlerts.Count > MaxAlertRows ? $"showing {MaxAlertRows} most urgent" : "most urgent first"));
            column.Item().Element(AlertsTable);

            column.Item().Element(c => SectionTitle(c, "Missions"));
            column.Item().Element(MissionsTable);
        });

        page.Footer().Element(Footer);
    });

    private static readonly Dictionary<HealthStatus, int> SeverityOrder = new()
    {
        [HealthStatus.Critical] = 0, [HealthStatus.Caution] = 1, [HealthStatus.Nominal] = 2, [HealthStatus.Unknown] = 3
    };

    private void CrewTable(IContainer container)
    {
        var threshold = report.Thresholds.ToDictionary(t => t.Metric);
        var rows = report.Crew
            .OrderBy(r => SeverityOrder[r.Astronaut.HealthStatus])
            .ThenBy(r => r.Astronaut.LastName)
            .ToList();

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn(2.4f); // astronaut
                columns.RelativeColumn(2.2f); // role · mission
                columns.RelativeColumn(1.3f); // status
                columns.RelativeColumn(1.1f); // ews
                columns.RelativeColumn(0.8f); // hr
                columns.RelativeColumn(0.8f); // spo2
                columns.RelativeColumn(1.1f); // bp
                columns.RelativeColumn(0.8f); // temp
                columns.RelativeColumn(1.6f); // last reading
            });

            table.Header(header =>
            {
                foreach (var title in new[] { "ASTRONAUT", "ROLE · MISSION", "STATUS", "EWS", "HR", "SPO2", "BP", "TEMP", "LAST READING (UTC)" })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            for (var i = 0; i < rows.Count; i++)
            {
                var (a, latest) = (rows[i].Astronaut, rows[i].Latest);
                var shaded = i % 2 == 1;
                IContainer Cell() => BodyCell(table.Cell(), shaded);

                Cell().Column(c =>
                {
                    c.Item().Text($"{a.FirstName} {a.LastName}").SemiBold();
                    c.Item().Text(a.Agency).FontSize(7).FontColor(C(Muted));
                });
                Cell().Column(c =>
                {
                    c.Item().Text(Humanize(a.Role));
                    c.Item().Text(a.MissionName ?? "Unassigned").FontSize(7).FontColor(C(Muted));
                });
                Cell().Element(c => Pill(c, a.HealthStatus.ToString(), ToneOf(a.HealthStatus)));

                if (latest is null)
                {
                    Cell().Text("—").FontColor(C(Faint));
                    for (var k = 0; k < 4; k++) Cell().Text("—").FontColor(C(Faint));
                }
                else
                {
                    Cell().Element(c => Pill(c, $"{latest.EarlyWarningScore} · {Humanize(latest.EarlyWarningRisk)}", ToneOf(latest.EarlyWarningRisk)));
                    Cell().Element(c => Value(c, latest.HeartRateBpm.ToString(), ToneOf(latest.HeartRateBpm, threshold.GetValueOrDefault(VitalMetric.HeartRate)), true));
                    Cell().Element(c => Value(c, Number(latest.OxygenSaturationPct), ToneOf(latest.OxygenSaturationPct, threshold.GetValueOrDefault(VitalMetric.OxygenSaturation)), true));
                    var bpTone = (Tone)Math.Max(
                        (int)ToneOf(latest.SystolicMmHg, threshold.GetValueOrDefault(VitalMetric.SystolicPressure)),
                        (int)ToneOf(latest.DiastolicMmHg, threshold.GetValueOrDefault(VitalMetric.DiastolicPressure)));
                    Cell().Element(c => Value(c, $"{latest.SystolicMmHg}/{latest.DiastolicMmHg}", bpTone, true));
                    Cell().Element(c => Value(c, Number(latest.BodyTemperatureC), ToneOf(latest.BodyTemperatureC, threshold.GetValueOrDefault(VitalMetric.BodyTemperature)), true));
                }

                Cell().Text(a.LastReadingAtUtc is { } at ? Short(at) : "Never").FontSize(7.5f).FontColor(C(Muted));
            }
        });
    }

    private void AlertsTable(IContainer container)
    {
        if (report.OpenAlerts.Count == 0)
        {
            container.Element(c => Note(c, "No open alerts — all crew within safe limits."));
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn(1.4f);
                columns.RelativeColumn(1.8f);
                columns.RelativeColumn(4.0f);
                columns.RelativeColumn(1.1f);
                columns.RelativeColumn(1.25f);
            });

            table.Header(header =>
            {
                foreach (var title in new[] { "RAISED (UTC)", "ASTRONAUT", "FINDING", "SEVERITY", "ESCALATION" })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            var alerts = report.OpenAlerts.Take(MaxAlertRows).ToList();
            for (var i = 0; i < alerts.Count; i++)
            {
                var alert = alerts[i];
                IContainer Cell() => BodyCell(table.Cell(), i % 2 == 1);

                Cell().Text(Short(alert.RaisedAtUtc)).FontSize(7.5f).FontColor(C(Muted));
                Cell().Text(alert.AstronautName).SemiBold();
                Cell().Text(alert.Message);
                Cell().Element(c => Pill(c, alert.Severity.ToString(), ToneOf(alert.Severity)));
                if (alert.EscalationLevel > 0)
                {
                    Cell().Element(c => Pill(c, $"Level {alert.EscalationLevel}", Tone.Critical));
                }
                else
                {
                    Cell().Text("—").FontColor(C(Faint));
                }
            }
        });
    }

    private void MissionsTable(IContainer container)
    {
        if (report.Missions.Count == 0)
        {
            container.Element(c => Note(c, "No missions on the manifest."));
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn(2.4f);
                columns.RelativeColumn(1.6f);
                columns.RelativeColumn(1.2f);
                columns.RelativeColumn(1.4f);
                columns.RelativeColumn(0.8f);
            });

            table.Header(header =>
            {
                foreach (var title in new[] { "MISSION", "DESTINATION", "STATUS", "LAUNCH", "CREW" })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            for (var i = 0; i < report.Missions.Count; i++)
            {
                var mission = report.Missions[i];
                IContainer Cell() => BodyCell(table.Cell(), i % 2 == 1);

                Cell().Text(mission.Name).SemiBold();
                Cell().Text(Humanize(mission.Destination));
                Cell().Element(c => Pill(c, mission.Status.ToString(), mission.Status switch
                {
                    Domain.Missions.MissionStatus.Active => Tone.Accent,
                    Domain.Missions.MissionStatus.Completed => Tone.Nominal,
                    Domain.Missions.MissionStatus.Aborted => Tone.Critical,
                    _ => Tone.Neutral
                }));
                Cell().Text(mission.LaunchDate.ToString("dd MMM yyyy"));
                Cell().Text(mission.CrewCount.ToString());
            }
        });
    }
}
