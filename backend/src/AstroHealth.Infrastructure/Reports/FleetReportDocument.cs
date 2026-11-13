using AstroHealth.Application.Hazards;
using AstroHealth.Application.Reports;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Hazards;
using AstroHealth.Domain.Missions;
using AstroHealth.Domain.Vitals;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using static AstroHealth.Infrastructure.Reports.PdfKit;
using static AstroHealth.Infrastructure.Reports.ReportTheme;

namespace AstroHealth.Infrastructure.Reports;

/// <summary>
/// Fleet health report: summary, the five hazards of spaceflight with each spacecraft's cabin
/// environment, every crew member's status and vitals, open alerts and missions.
/// </summary>
internal sealed class FleetReportDocument(FleetReport report) : IDocument
{
    private const string Title = "Fleet health report";
    private const int MaxAlertRows = 25;

    private readonly Dictionary<Guid, CrewHazardsResponse> _crewHazards =
        report.Hazards?.Missions.SelectMany(m => m.Crew).ToDictionary(c => c.AstronautId) ?? [];

    public DocumentMetadata GetMetadata() => new()
    {
        Title = $"{Brand} {Title.ToLowerInvariant()}",
        Author = Brand,
        Subject = "Crew health across every active mission",
        CreationDate = report.GeneratedAtUtc
    };

    public void Compose(IDocumentContainer container) => container.Page(page =>
    {
        Page(page);
        var summary = report.Summary;
        page.Header().SkipOnce().Element(c => RunningHeader(c, Title));

        page.Content().Column(column =>
        {
            var section = 0;
            column.Item().Element(c => TitleBlock(c, "Fleet report", Title,
                "Crew health across every active mission, assessed against NASA's five hazards of human spaceflight.",
                [
                    ("Report ID", $"FLT-{report.GeneratedAtUtc.UtcDateTime:yyyyMMdd-HHmm}"),
                    ("Generated", Utc(report.GeneratedAtUtc)),
                    ("Scope", $"{summary.ActiveMissions} mission{(summary.ActiveMissions == 1 ? "" : "s")} in flight · {summary.TotalCrew} crew"),
                    ("Classification", Classification)
                ]));

            column.Item().Element(c => Section(c, ++section, "Summary"));
            column.Item().Element(Summary);

            if (report.Hazards is { } hazards)
            {
                column.Item().Element(c => Section(c, ++section, "Five hazards of spaceflight", "NASA Human Research Program"));
                column.Item().Element(c => HazardsTable(c, hazards));
                if (hazards.Missions.Count > 0)
                {
                    column.Item().Element(c => Section(c, ++section, "Cabin environment", "latest reading per spacecraft"));
                    column.Item().Element(c => CabinTable(c, hazards));
                }
            }

            column.Item().Element(c => Section(c, ++section, "Crew status", $"{report.Crew.Count} crew · most severe first"));
            column.Item().Element(CrewTable);

            column.Item().Element(c => Section(c, ++section, "Open alerts",
                report.OpenAlerts.Count > MaxAlertRows ? $"{MaxAlertRows} most urgent of {report.OpenAlerts.Count}" : "most urgent first"));
            column.Item().Element(AlertsTable);

            column.Item().Element(c => Section(c, ++section, "Missions"));
            column.Item().Element(MissionsTable);
        });

        page.Footer().Element(c => Footer(c, Title));
    });

    private void Summary(IContainer container)
    {
        var s = report.Summary;
        container.Row(row =>
        {
            row.Spacing(8);
            row.RelativeItem().Element(c => Kpi(c, "Crew health", $"{s.CrewHealth.Nominal} of {s.TotalCrew}", Tone.Neutral,
                $"nominal · {s.CrewHealth.Critical} critical · {s.CrewHealth.Caution} caution"));
            row.RelativeItem().Element(c => Kpi(c, "Open alerts", s.OpenAlerts.ToString(),
                s.OpenCriticalAlerts > 0 ? Tone.Critical : s.OpenAlerts > 0 ? Tone.Caution : Tone.Neutral,
                $"{s.OpenCriticalAlerts} critical"));
            row.RelativeItem().Element(c => Kpi(c, "Escalated", s.EscalatedAlerts.ToString(),
                s.EscalatedAlerts > 0 ? Tone.Critical : Tone.Neutral, "awaiting acknowledgement"));
            row.RelativeItem().Element(c => Kpi(c, "Missions in flight", s.ActiveMissions.ToString(), Tone.Neutral,
                $"{report.Missions.Count} on the manifest"));
            row.RelativeItem().Element(c => Kpi(c, "Readings, 24 h", s.ReadingsLast24Hours.ToString("N0"), Tone.Neutral, "telemetry samples"));
        });
    }

    private static void HazardsTable(IContainer container, HazardOverviewResponse hazards)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn(2.3f);
                columns.RelativeColumn(1.1f);
                columns.RelativeColumn(1.5f);
                columns.RelativeColumn(4.2f);
            });

            table.Header(header =>
            {
                foreach (var title in new[] { "Hazard", "Fleet status", "Crew affected", "How VITA monitors it" })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            foreach (var hazard in ReportHazards.Order)
            {
                var s = hazards.Summary.FirstOrDefault(x => x.Hazard == hazard);
                var worst = s?.Worst ?? HealthStatus.Unknown;
                var affected = (s?.Critical ?? 0) + (s?.Caution ?? 0);
                IContainer Cell() => BodyCell(table.Cell(), false);

                Cell().Text(ReportHazards.Label(hazard)).SemiBold();
                Cell().Element(c => Pill(c, ReportHazards.StatusLabel(worst), ReportHazards.ToneOf(worst)));
                Cell().Text(worst == HealthStatus.Unknown ? "Awaiting data" : affected == 0 ? "None" : $"{affected} ({s!.Critical} critical)")
                    .FontColor(C(affected > 0 ? Ink : Muted));
                Cell().Text(ReportHazards.Monitors(hazard)).FontSize(7.5f).FontColor(C(Muted));
            }
        });
    }

    private static void CabinTable(IContainer container, HazardOverviewResponse hazards)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn(1.9f);
                columns.RelativeColumn(1.3f);
                for (var i = 0; i < 6; i++) columns.RelativeColumn(1f);
                columns.RelativeColumn(1.1f);
            });

            table.Header(header =>
            {
                foreach (var title in new[] { "Spacecraft", "Signal delay", "CO₂ mmHg", "O₂ %", "kPa", "°C", "RH %", "mSv/day", "Status" })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            foreach (var mission in hazards.Missions)
            {
                IContainer Cell() => BodyCell(table.Cell(), false);
                Cell().Column(c =>
                {
                    c.Item().Text(mission.Name).SemiBold();
                    c.Item().Text($"{Humanize(mission.Destination)} · day {mission.ElapsedDays}").FontSize(7).FontColor(C(Muted));
                });
                Cell().Column(c =>
                {
                    c.Item().Text(ReportHazards.SignalDelay(mission.CommunicationDelay));
                    c.Item().Text(mission.CommunicationDelay.Autonomy == AutonomyLevel.EarthIndependent ? "Earth-independent" : "Earth-supported")
                        .FontSize(7).FontColor(C(mission.CommunicationDelay.Autonomy == AutonomyLevel.EarthIndependent ? Caution : Muted));
                });

                if (mission.Habitat is not { } h)
                {
                    for (var i = 0; i < 6; i++) Cell().Text("—").FontColor(C(Faint));
                    Cell().Element(c => Pill(c, "No data", Tone.Neutral));
                    continue;
                }

                (HabitatMetric Metric, decimal Value, string Format)[] cells =
                [
                    (HabitatMetric.CarbonDioxide, h.CarbonDioxideMmHg, "0.0"),
                    (HabitatMetric.Oxygen, h.OxygenPct, "0.0"),
                    (HabitatMetric.CabinPressure, h.CabinPressureKpa, "0.0"),
                    (HabitatMetric.CabinTemperature, h.CabinTemperatureC, "0.0"),
                    (HabitatMetric.Humidity, h.HumidityPct, "0"),
                    (HabitatMetric.RadiationDoseRate, h.RadiationDoseRateMsvPerDay, "0.00")
                ];
                foreach (var (metric, value, format) in cells)
                {
                    var tone = ReportHazards.HabitatTone(metric, value);
                    Cell().Element(c => Value(c, value.ToString(format, System.Globalization.CultureInfo.InvariantCulture), tone == Tone.Nominal ? Tone.Neutral : tone));
                }
                Cell().Element(c => Pill(c, ReportHazards.StatusLabel(h.Status), ReportHazards.ToneOf(h.Status)));
            }
        });
    }

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
                columns.RelativeColumn(2.3f); // crew member
                columns.RelativeColumn(1.2f); // status
                columns.RelativeColumn(0.7f); // ews
                columns.RelativeColumn(0.7f); // hr
                columns.RelativeColumn(0.8f); // spo2
                columns.RelativeColumn(1f);   // bp
                columns.RelativeColumn(0.7f); // temp
                columns.RelativeColumn(1.5f); // mission dose
                columns.RelativeColumn(1.3f); // last reading
            });

            table.Header(header =>
            {
                foreach (var title in new[] { "Crew member", "Status", "EWS", "HR", "SpO₂", "BP", "Temp", "Mission dose", "Last reading" })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            foreach (var (a, latest) in rows.Select(r => (r.Astronaut, r.Latest)))
            {
                IContainer Cell() => BodyCell(table.Cell(), false);

                Cell().Column(c =>
                {
                    c.Item().Text($"{a.FirstName} {a.LastName}").SemiBold();
                    c.Item().Text($"{Humanize(a.Role)} · {a.MissionName ?? "Unassigned"}").FontSize(7).FontColor(C(Muted));
                });
                Cell().Element(c => Pill(c, ReportHazards.StatusLabel(a.HealthStatus), ToneOf(a.HealthStatus)));

                if (latest is null)
                {
                    for (var k = 0; k < 5; k++) Cell().Text("—").FontColor(C(Faint));
                }
                else
                {
                    Cell().Element(c => Value(c, latest.EarlyWarningScore.ToString(), ToneOf(latest.EarlyWarningRisk) == Tone.Nominal ? Tone.Neutral : ToneOf(latest.EarlyWarningRisk), true));
                    Cell().Element(c => Value(c, latest.HeartRateBpm.ToString(), Flag(ToneOf(latest.HeartRateBpm, threshold.GetValueOrDefault(VitalMetric.HeartRate)))));
                    Cell().Element(c => Value(c, Number(latest.OxygenSaturationPct), Flag(ToneOf(latest.OxygenSaturationPct, threshold.GetValueOrDefault(VitalMetric.OxygenSaturation)))));
                    var bpTone = (Tone)Math.Max(
                        (int)ToneOf(latest.SystolicMmHg, threshold.GetValueOrDefault(VitalMetric.SystolicPressure)),
                        (int)ToneOf(latest.DiastolicMmHg, threshold.GetValueOrDefault(VitalMetric.DiastolicPressure)));
                    Cell().Element(c => Value(c, $"{latest.SystolicMmHg}/{latest.DiastolicMmHg}", Flag(bpTone)));
                    Cell().Element(c => Value(c, Number(latest.BodyTemperatureC), Flag(ToneOf(latest.BodyTemperatureC, threshold.GetValueOrDefault(VitalMetric.BodyTemperature)))));
                }

                if (_crewHazards.TryGetValue(a.Id, out var hz))
                {
                    var r = hz.Radiation;
                    Cell().Column(c =>
                    {
                        c.Item().Text($"{r.MissionDoseMsv:0.0} mSv");
                        c.Item().Text($"{r.PercentOfLimit:0.#}% of career limit").FontSize(6.8f).FontColor(C(r.PercentOfLimit >= 80 ? Caution : Muted));
                    });
                }
                else
                {
                    Cell().Text("—").FontColor(C(Faint));
                }

                Cell().Text(a.LastReadingAtUtc is { } at ? Short(at) : "Never").FontSize(7.5f).FontColor(C(Muted));
            }
        });
    }

    /// <summary>Only out-of-range values take a colour; in-range values stay ink.</summary>
    private static Tone Flag(Tone tone) => tone == Tone.Nominal ? Tone.Neutral : tone;

    private void AlertsTable(IContainer container)
    {
        if (report.OpenAlerts.Count == 0)
        {
            container.Element(c => Note(c, "No open alerts. Every crew member is within safe limits."));
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn(1.3f);
                columns.RelativeColumn(1.7f);
                columns.RelativeColumn(4.2f);
                columns.RelativeColumn(1.1f);
                columns.RelativeColumn(1.1f);
            });

            table.Header(header =>
            {
                foreach (var title in new[] { "Raised (UTC)", "Crew member", "Finding", "Severity", "Escalation" })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            foreach (var alert in report.OpenAlerts.Take(MaxAlertRows))
            {
                IContainer Cell() => BodyCell(table.Cell(), false);

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
                foreach (var title in new[] { "Mission", "Destination", "Status", "Launch", "Crew" })
                {
                    header.Cell().Element(HeadCell).Text(title);
                }
            });

            foreach (var mission in report.Missions)
            {
                IContainer Cell() => BodyCell(table.Cell(), false);

                Cell().Text(mission.Name).SemiBold();
                Cell().Text(Humanize(mission.Destination));
                Cell().Element(c => Pill(c, mission.Status == MissionStatus.Active ? "In flight" : mission.Status.ToString(), mission.Status switch
                {
                    MissionStatus.Active => Tone.Nominal,
                    MissionStatus.Aborted => Tone.Critical,
                    _ => Tone.Neutral
                }));
                Cell().Text(mission.LaunchDate.ToString("dd MMM yyyy", System.Globalization.CultureInfo.InvariantCulture));
                Cell().Text(mission.CrewCount.ToString());
            }
        });
    }
}
