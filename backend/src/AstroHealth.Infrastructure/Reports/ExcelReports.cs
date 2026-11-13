using AstroHealth.Application.Hazards;
using AstroHealth.Application.Reports;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Hazards;
using AstroHealth.Domain.Vitals;
using ClosedXML.Excel;
using static AstroHealth.Infrastructure.Reports.ReportTheme;

namespace AstroHealth.Infrastructure.Reports;

/// <summary>
/// Excel exports built like analyst-grade workbooks: a summary sheet first, real Excel tables
/// (filter/sort/structured references), live conditional formatting driven by the clinical
/// thresholds, formulas instead of pasted numbers, frozen headers and print-ready page setup.
/// </summary>
internal static class ExcelReports
{
    private const int TitleRow = 1;
    private const int SubtitleRow = 2;
    private const int HeaderRow = 4;
    private const string DateFormat = "yyyy-mm-dd hh:mm:ss";

    // ---- Workbooks ------------------------------------------------------------------------

    public static byte[] Alerts(AlertsReport report)
    {
        using var workbook = NewWorkbook("Health alerts", report.GeneratedAtUtc);
        var filter = string.Join(" · ", new[]
        {
            report.Filter.Status is { } s ? $"Status: {s}" : "All statuses",
            report.Filter.Severity is { } v ? $"Severity: {v}" : "All severities"
        });

        var summary = Sheet(workbook, "Summary", "Health alerts — summary", $"{filter} · generated {Utc(report.GeneratedAtUtc)}", 5);
        var sheet = Sheet(workbook, "Alerts", "Health alerts", $"{report.Alerts.Count:N0} alerts · {filter} · times in UTC", 11);

        string[] headers = ["Raised (UTC)", "Astronaut", "Metric", "Severity", "Status", "Escalation", "Observed", "Finding",
            "Acknowledged (UTC)", "Resolved (UTC)", "Resolution note"];
        var table = Table(sheet, "Alerts", headers, report.Alerts.Count, [19, 20, 18, 11, 14, 11, 10, 52, 19, 19, 34]);

        for (var i = 0; i < report.Alerts.Count; i++)
        {
            var a = report.Alerts[i];
            var row = HeaderRow + 1 + i;
            sheet.Cell(row, 1).Value = a.RaisedAtUtc.UtcDateTime;
            sheet.Cell(row, 2).Value = a.AstronautName;
            sheet.Cell(row, 3).Value = Humanize(a.Metric);
            sheet.Cell(row, 4).Value = a.Severity.ToString();
            sheet.Cell(row, 5).Value = a.Status.ToString();
            sheet.Cell(row, 6).Value = a.EscalationLevel;
            sheet.Cell(row, 7).Value = (double)a.ObservedValue;
            sheet.Cell(row, 8).Value = a.Message;
            if (a.AcknowledgedAtUtc is { } ack) sheet.Cell(row, 9).Value = ack.UtcDateTime;
            if (a.ResolvedAtUtc is { } res) sheet.Cell(row, 10).Value = res.UtcDateTime;
            sheet.Cell(row, 11).Value = a.ResolutionNote ?? "";
        }

        Format(table, [1, 9, 10], DateFormat);
        Format(table, [7], "0.###");
        Center(table, [4, 5, 6]);
        Highlight(table.DataRange.Column(4), "Critical", Critical, CriticalSoft);
        Highlight(table.DataRange.Column(4), "Warning", Caution, CautionSoft);
        Highlight(table.DataRange.Column(5), "Open", Accent, AccentSoft);
        Highlight(table.DataRange.Column(5), "Acknowledged", Ink, Raised);
        Highlight(table.DataRange.Column(5), "Resolved", Muted, Panel);
        table.DataRange.Column(6).AddConditionalFormat().WhenGreaterThan(0)
            .Font.SetBold().Font.SetFontColor(X(Critical)).Fill.SetBackgroundColor(X(CriticalSoft));

        // Summary: live COUNTIFS over the Alerts table — stays correct if the user filters/edits.
        summary.Cell(HeaderRow, 1).Value = "Severity";
        string[] statuses = ["Open", "Acknowledged", "Resolved"];
        for (var c = 0; c < statuses.Length; c++) summary.Cell(HeaderRow, 2 + c).Value = statuses[c];
        summary.Cell(HeaderRow, 5).Value = "Total";
        string[] severities = ["Critical", "Warning"];
        for (var r = 0; r < severities.Length; r++)
        {
            var row = HeaderRow + 1 + r;
            summary.Cell(row, 1).Value = severities[r];
            for (var c = 0; c < statuses.Length; c++)
            {
                summary.Cell(row, 2 + c).FormulaA1 = $"COUNTIFS(Alerts[Severity],\"{severities[r]}\",Alerts[Status],\"{statuses[c]}\")";
            }
            summary.Cell(row, 5).FormulaA1 = $"SUM(B{row}:D{row})";
        }
        var totalRow = HeaderRow + 1 + severities.Length;
        summary.Cell(totalRow, 1).Value = "Total";
        for (var c = 2; c <= 5; c++)
        {
            var col = summary.Column(c).ColumnLetter();
            summary.Cell(totalRow, c).FormulaA1 = $"SUM({col}{HeaderRow + 1}:{col}{totalRow - 1})";
        }
        StyleMatrix(summary, HeaderRow, totalRow, 5, [16, 14, 16, 14, 12]);

        var byAstronautRow = totalRow + 3;
        summary.Cell(byAstronautRow - 1, 1).Value = "By astronaut";
        summary.Cell(byAstronautRow - 1, 1).Style.Font.SetBold().Font.SetFontColor(X(Ink));
        string[] astronautHeaders = ["Astronaut", "Open", "Critical", "Escalated", "Total"];
        for (var c = 0; c < astronautHeaders.Length; c++) summary.Cell(byAstronautRow, 1 + c).Value = astronautHeaders[c];
        var names = report.Alerts.Select(a => a.AstronautName).Distinct().Order().ToList();
        for (var i = 0; i < names.Count; i++)
        {
            var row = byAstronautRow + 1 + i;
            summary.Cell(row, 1).Value = names[i];
            summary.Cell(row, 2).FormulaA1 = $"COUNTIFS(Alerts[Astronaut],A{row},Alerts[Status],\"Open\")";
            summary.Cell(row, 3).FormulaA1 = $"COUNTIFS(Alerts[Astronaut],A{row},Alerts[Severity],\"Critical\")";
            summary.Cell(row, 4).FormulaA1 = $"COUNTIFS(Alerts[Astronaut],A{row},Alerts[Escalation],\">0\")";
            summary.Cell(row, 5).FormulaA1 = $"COUNTIFS(Alerts[Astronaut],A{row})";
        }
        StyleMatrix(summary, byAstronautRow, byAstronautRow + Math.Max(names.Count, 1), 5, null);

        summary.SetTabActive();
        return Save(workbook);
    }

    public static byte[] Vitals(VitalsReport report)
    {
        var a = report.Astronaut;
        using var workbook = NewWorkbook($"Vitals — {a.FirstName} {a.LastName}", report.GeneratedAtUtc);
        var subtitle = $"{Humanize(a.Role)} · {a.MissionName ?? "Unassigned"} · last {report.WindowHours}h · generated {Utc(report.GeneratedAtUtc)}";

        var stats = Sheet(workbook, "Statistics", $"{a.FirstName} {a.LastName} — vital statistics", subtitle, 8);
        var sheet = Sheet(workbook, "Readings", $"{a.FirstName} {a.LastName} — vitals", $"{report.Readings.Count:N0} readings · times in UTC", 11);
        var reference = Sheet(workbook, "Thresholds", "Clinical reference ranges", "Values outside the warning range are highlighted amber, outside the critical range red", 6);

        // Readings
        var metrics = new (VitalMetric Metric, string Header, double Width, string Format)[]
        {
            (VitalMetric.HeartRate, "Heart rate (bpm)", 15, "0"),
            (VitalMetric.SystolicPressure, "Systolic (mmHg)", 15, "0"),
            (VitalMetric.DiastolicPressure, "Diastolic (mmHg)", 15, "0"),
            (VitalMetric.OxygenSaturation, "SpO2 (%)", 11, "0.0"),
            (VitalMetric.BodyTemperature, "Temperature (°C)", 15, "0.0"),
            (VitalMetric.RespiratoryRate, "Respiration (/min)", 16, "0"),
            (VitalMetric.RadiationDose, "Dose rate (mSv/day)", 18, "0.000")
        };

        string[] headers = ["Recorded (UTC)", .. metrics.Select(m => m.Header), "EWS", "Risk", "Notes"];
        var table = Table(sheet, "Readings", headers, report.Readings.Count, [19, .. metrics.Select(m => m.Width), 8, 12, 34]);
        var thresholds = report.Thresholds.ToDictionary(t => t.Metric);

        for (var i = 0; i < report.Readings.Count; i++)
        {
            var r = report.Readings[i];
            var row = HeaderRow + 1 + i;
            sheet.Cell(row, 1).Value = r.RecordedAtUtc.UtcDateTime;
            for (var m = 0; m < metrics.Length; m++)
            {
                sheet.Cell(row, 2 + m).Value = (double)ValueOf(r, metrics[m].Metric);
            }
            sheet.Cell(row, 9).Value = r.EarlyWarningScore;
            sheet.Cell(row, 10).Value = Humanize(r.EarlyWarningRisk);
            sheet.Cell(row, 11).Value = r.Notes ?? "";
        }

        Format(table, [1], DateFormat);
        for (var m = 0; m < metrics.Length; m++)
        {
            Format(table, [2 + m], metrics[m].Format);
            if (report.Readings.Count > 0 && thresholds.TryGetValue(metrics[m].Metric, out var t))
            {
                ThresholdFormatting(table.DataRange.Column(2 + m), t);
            }
        }
        Center(table, [9, 10]);
        EwsFormatting(table.DataRange.Column(9));

        // Statistics: formulas over the Readings table.
        string[] statHeaders = ["Metric", "Min", "Average", "Max", "Latest", "Out of range", "Safe range", "Unit"];
        for (var c = 0; c < statHeaders.Length; c++) stats.Cell(HeaderRow, 1 + c).Value = statHeaders[c];
        for (var m = 0; m < metrics.Length; m++)
        {
            var row = HeaderRow + 1 + m;
            var column = $"Readings[{metrics[m].Header}]";
            var t = thresholds.GetValueOrDefault(metrics[m].Metric);
            stats.Cell(row, 1).Value = t?.Label ?? metrics[m].Header;
            if (report.Readings.Count > 0)
            {
                stats.Cell(row, 2).FormulaA1 = $"MIN({column})";
                stats.Cell(row, 3).FormulaA1 = $"AVERAGE({column})";
                stats.Cell(row, 4).FormulaA1 = $"MAX({column})";
                stats.Cell(row, 5).FormulaA1 = $"INDEX({column},ROWS({column}))";
                var outside = new List<string>();
                if (t?.WarningLow is { } lo) outside.Add($"COUNTIFS({column},\"<{lo}\")");
                if (t?.WarningHigh is { } hi) outside.Add($"COUNTIFS({column},\">{hi}\")");
                stats.Cell(row, 6).FormulaA1 = outside.Count > 0 ? string.Join("+", outside) : "0";
            }
            stats.Cell(row, 7).Value = t is null ? "" : SafeRange(t);
            stats.Cell(row, 8).Value = t?.Unit ?? "";
            stats.Range(row, 2, row, 5).Style.NumberFormat.Format = metrics[m].Format == "0" ? "0.0" : metrics[m].Format;
        }
        var lastStatRow = HeaderRow + metrics.Length;
        StyleMatrix(stats, HeaderRow, lastStatRow, 8, [22, 11, 11, 11, 11, 13, 20, 12]);
        stats.Range(HeaderRow + 1, 6, lastStatRow, 6).AddConditionalFormat().WhenGreaterThan(0)
            .Font.SetBold().Font.SetFontColor(X(Caution)).Fill.SetBackgroundColor(X(CautionSoft));
        stats.Cell(lastStatRow + 2, 1).Value = "Readings in window";
        stats.Cell(lastStatRow + 2, 2).FormulaA1 = report.Readings.Count > 0 ? "ROWS(Readings[Recorded (UTC)])" : "0";
        stats.Cell(lastStatRow + 2, 1).Style.Font.SetFontColor(X(Muted));

        WriteThresholds(reference, report.Thresholds);

        stats.SetTabActive();
        return Save(workbook);
    }

    public static byte[] Crew(FleetReport report)
    {
        using var workbook = NewWorkbook("Crew roster", report.GeneratedAtUtc);
        var sheet = Sheet(workbook, "Crew", "Crew roster and latest vitals",
            $"{report.Crew.Count} crew · {report.Summary.ActiveMissions} missions in flight · generated {Utc(report.GeneratedAtUtc)}", 18);
        var reference = Sheet(workbook, "Thresholds", "Clinical reference ranges", "Used for the highlighting on the Crew sheet", 6);

        string[] headers = ["Astronaut", "Agency", "Role", "Mission", "Health", "Open alerts", "EWS", "Risk",
            "Heart rate (bpm)", "SpO2 (%)", "Systolic (mmHg)", "Diastolic (mmHg)", "Temperature (°C)", "Respiration (/min)",
            "Dose rate (mSv/day)", "Mission dose (mSv)", "Career limit (%)", "Last reading (UTC)"];
        var rows = report.Crew.OrderBy(r => r.Astronaut.LastName).ToList();
        var table = Table(sheet, "Crew", headers, rows.Count, [22, 12, 18, 18, 11, 11, 7, 12, 15, 10, 15, 15, 15, 16, 17, 17, 15, 19]);
        var radiation = report.Hazards?.Missions.SelectMany(m => m.Crew).ToDictionary(c => c.AstronautId, c => c.Radiation) ?? [];
        var thresholds = report.Thresholds.ToDictionary(t => t.Metric);
        VitalMetric[] metricColumns =
        [
            VitalMetric.HeartRate, VitalMetric.OxygenSaturation, VitalMetric.SystolicPressure, VitalMetric.DiastolicPressure,
            VitalMetric.BodyTemperature, VitalMetric.RespiratoryRate, VitalMetric.RadiationDose
        ];

        for (var i = 0; i < rows.Count; i++)
        {
            var (a, latest) = (rows[i].Astronaut, rows[i].Latest);
            var row = HeaderRow + 1 + i;
            sheet.Cell(row, 1).Value = $"{a.FirstName} {a.LastName}";
            sheet.Cell(row, 2).Value = a.Agency;
            sheet.Cell(row, 3).Value = Humanize(a.Role);
            sheet.Cell(row, 4).Value = a.MissionName ?? "Unassigned";
            sheet.Cell(row, 5).Value = a.HealthStatus.ToString();
            sheet.Cell(row, 6).Value = a.OpenAlerts;
            if (latest is not null)
            {
                sheet.Cell(row, 7).Value = latest.EarlyWarningScore;
                sheet.Cell(row, 8).Value = Humanize(latest.EarlyWarningRisk);
                for (var m = 0; m < metricColumns.Length; m++)
                {
                    sheet.Cell(row, 9 + m).Value = (double)ValueOf(latest, metricColumns[m]);
                }
            }
            if (radiation.TryGetValue(a.Id, out var dose))
            {
                sheet.Cell(row, 16).Value = (double)dose.MissionDoseMsv;
                sheet.Cell(row, 17).Value = (double)dose.PercentOfLimit / 100;
            }
            if (a.LastReadingAtUtc is { } at) sheet.Cell(row, 18).Value = at.UtcDateTime;
        }

        Format(table, [18], DateFormat);
        Format(table, [9, 11, 12, 14], "0");
        Format(table, [10, 13], "0.0");
        Format(table, [15], "0.00");
        Format(table, [16], "0.0");
        Format(table, [17], "0.0%");
        table.DataRange.Column(17).AddConditionalFormat().WhenEqualOrGreaterThan(0.8)
            .Font.SetBold().Font.SetFontColor(X(Caution)).Fill.SetBackgroundColor(X(CautionSoft));
        Center(table, [5, 6, 7, 8]);
        Highlight(table.DataRange.Column(5), "Critical", Critical, CriticalSoft);
        Highlight(table.DataRange.Column(5), "Caution", Caution, CautionSoft);
        Highlight(table.DataRange.Column(5), "Nominal", Nominal, NominalSoft);
        EwsFormatting(table.DataRange.Column(7));
        if (rows.Count > 0)
        {
            for (var m = 0; m < metricColumns.Length; m++)
            {
                if (thresholds.TryGetValue(metricColumns[m], out var t)) ThresholdFormatting(table.DataRange.Column(9 + m), t);
            }
        }

        if (report.Hazards is { } hazards)
        {
            WriteHazards(workbook, hazards, report.GeneratedAtUtc);
        }

        WriteThresholds(reference, report.Thresholds);
        sheet.SetTabActive();
        return Save(workbook);
    }

    /// <summary>Crew × five hazards matrix and each spacecraft's latest cabin environment.</summary>
    private static void WriteHazards(XLWorkbook workbook, HazardOverviewResponse hazards, DateTimeOffset generatedAt)
    {
        var sheet = Sheet(workbook, "Hazards", "Five hazards of spaceflight",
            $"Each crew member assessed against NASA's five hazards of human spaceflight · generated {Utc(generatedAt)}", 9);
        sheet.Position = 2;

        string[] headers = ["Crew member", "Mission", "Overall", "Space radiation", "Isolation and confinement",
            "Distance from Earth", "Gravity fields", "Hostile and closed environments", "Mission dose (mSv)"];
        var crew = hazards.Missions.SelectMany(m => m.Crew.Select(c => (Mission: m.Name, Crew: c))).ToList();
        var table = Table(sheet, "Hazards", headers, crew.Count, [22, 16, 11, 16, 16, 16, 16, 18, 17]);

        for (var i = 0; i < crew.Count; i++)
        {
            var (mission, c) = crew[i];
            var row = HeaderRow + 1 + i;
            sheet.Cell(row, 1).Value = c.Name;
            sheet.Cell(row, 2).Value = mission;
            sheet.Cell(row, 3).Value = StatusText(c.Overall);
            for (var h = 0; h < ReportHazards.Order.Length; h++)
            {
                var status = c.Hazards.FirstOrDefault(x => x.Hazard == ReportHazards.Order[h]);
                var cell = sheet.Cell(row, 4 + h);
                cell.Value = StatusText(status?.Status ?? HealthStatus.Unknown);
                if (status is not null)
                {
                    cell.CreateComment().AddText(status.Detail is null ? status.Headline : $"{status.Headline}\n{status.Detail}");
                }
            }
            sheet.Cell(row, 9).Value = (double)c.Radiation.MissionDoseMsv;
        }

        Format(table, [9], "0.0");
        Center(table, [3, 4, 5, 6, 7, 8]);
        for (var col = 3; col <= 8; col++)
        {
            Highlight(table.DataRange.Column(col), "Critical", Critical, CriticalSoft);
            Highlight(table.DataRange.Column(col), "Caution", Caution, CautionSoft);
            Highlight(table.DataRange.Column(col), "Nominal", Nominal, NominalSoft);
        }

        // Cabin environment, below the matrix.
        var cabinHeader = HeaderRow + Math.Max(crew.Count, 1) + 3;
        sheet.Cell(cabinHeader - 1, 1).Value = "Cabin environment, latest reading";
        sheet.Cell(cabinHeader - 1, 1).Style.Font.SetBold().Font.SetFontColor(X(Ink));
        string[] cabinHeaders = ["Spacecraft", "Destination", "Signal delay", "CO₂ (mmHg)", "O₂ (%)", "Pressure (kPa)", "Temp (°C)", "Humidity (%)", "Dose rate (mSv/day)"];
        for (var c = 0; c < cabinHeaders.Length; c++) sheet.Cell(cabinHeader, 1 + c).Value = cabinHeaders[c];
        for (var i = 0; i < hazards.Missions.Count; i++)
        {
            var m = hazards.Missions[i];
            var row = cabinHeader + 1 + i;
            sheet.Cell(row, 1).Value = m.Name;
            sheet.Cell(row, 2).Value = Humanize(m.Destination);
            sheet.Cell(row, 3).Value = ReportHazards.SignalDelay(m.CommunicationDelay);
            if (m.Habitat is not { } h) continue;
            (HabitatMetric Metric, decimal Value)[] cells =
            [
                (HabitatMetric.CarbonDioxide, h.CarbonDioxideMmHg), (HabitatMetric.Oxygen, h.OxygenPct),
                (HabitatMetric.CabinPressure, h.CabinPressureKpa), (HabitatMetric.CabinTemperature, h.CabinTemperatureC),
                (HabitatMetric.Humidity, h.HumidityPct), (HabitatMetric.RadiationDoseRate, h.RadiationDoseRateMsvPerDay)
            ];
            for (var k = 0; k < cells.Length; k++)
            {
                var cell = sheet.Cell(row, 4 + k);
                cell.Value = (double)cells[k].Value;
                cell.Style.NumberFormat.Format = cells[k].Metric == HabitatMetric.RadiationDoseRate ? "0.00" : "0.0";
                var tone = ReportHazards.HabitatTone(cells[k].Metric, cells[k].Value);
                if (tone is Tone.Caution or Tone.Critical)
                {
                    cell.Style.Font.SetBold().Font.SetFontColor(X(Palette(tone).Fg)).Fill.SetBackgroundColor(X(Palette(tone).Bg));
                }
            }
        }
        StyleMatrix(sheet, cabinHeader, cabinHeader + Math.Max(hazards.Missions.Count, 1), cabinHeaders.Length, null);
    }

    private static string StatusText(HealthStatus status) => status == HealthStatus.Unknown ? "No data" : status.ToString();

    // ---- Building blocks ------------------------------------------------------------------

    private static XLColor X(string hex) => XLColor.FromHtml(hex);

    private static XLWorkbook NewWorkbook(string title, DateTimeOffset generatedAt)
    {
        var workbook = new XLWorkbook();
        workbook.Style.Font.FontName = "Calibri";
        workbook.Style.Font.FontSize = 10;
        workbook.Properties.Author = Brand;
        workbook.Properties.Company = BrandFull;
        workbook.Properties.Title = $"{Brand} — {title}";
        workbook.Properties.Subject = title;
        workbook.Properties.Comments = $"Generated {Utc(generatedAt)}. {Classification}. {Disclaimer}.";
        return workbook;
    }

    /// <summary>A sheet with the branded title block (rows 1–2); data starts at <see cref="HeaderRow"/>.</summary>
    private static IXLWorksheet Sheet(XLWorkbook workbook, string name, string title, string subtitle, int columns)
    {
        var sheet = workbook.Worksheets.Add(name);
        sheet.ShowGridLines = false;
        sheet.TabColor = X(Accent);

        // Title: the "VITA." wordmark (indigo full stop) followed by the sheet title.
        var titleText = sheet.Cell(TitleRow, 1).GetRichText();
        titleText.AddText(Brand).SetBold().SetFontSize(12).SetFontColor(X(Ink));
        titleText.AddText(".").SetBold().SetFontSize(12).SetFontColor(X(Accent));
        titleText.AddText("   ").SetFontSize(12);
        titleText.AddText(title).SetBold().SetFontSize(15).SetFontColor(X(Ink));
        sheet.Row(TitleRow).Height = 28;
        sheet.Cell(TitleRow, 1).Style.Alignment.SetVertical(XLAlignmentVerticalValues.Center);

        var subtitleCell = sheet.Cell(SubtitleRow, 1);
        subtitleCell.Value = $"{subtitle} · {Classification}";
        subtitleCell.Style.Font.SetFontColor(X(Muted)).Font.SetFontSize(9);

        // Hairline under the title block.
        sheet.Range(SubtitleRow, 1, SubtitleRow, columns).Style.Border.BottomBorder = XLBorderStyleValues.Thin;
        sheet.Range(SubtitleRow, 1, SubtitleRow, columns).Style.Border.BottomBorderColor = X(LineStrong);
        sheet.Row(HeaderRow - 1).Height = 8;

        sheet.PageSetup.PageOrientation = XLPageOrientation.Landscape;
        sheet.PageSetup.FitToPages(1, 0);
        sheet.PageSetup.Margins.SetLeft(0.4).SetRight(0.4).SetTop(0.5).SetBottom(0.5);
        sheet.PageSetup.Footer.Left.AddText($"{Brand} · {title}");
        sheet.PageSetup.Footer.Right.AddText("&P / &N");
        sheet.PageSetup.Footer.Center.AddText($"{Classification}. {Disclaimer}.");
        return sheet;
    }

    /// <summary>Header row + an Excel table spanning the data (at least one row, so Excel accepts it).</summary>
    private static IXLTable Table(IXLWorksheet sheet, string name, string[] headers, int rowCount, double[] widths)
    {
        for (var c = 0; c < headers.Length; c++)
        {
            sheet.Cell(HeaderRow, 1 + c).Value = headers[c];
            sheet.Column(1 + c).Width = widths[c];
        }

        if (rowCount == 0)
        {
            sheet.Cell(HeaderRow + 1, 1).Value = "No data for the selected filters";
            sheet.Cell(HeaderRow + 1, 1).Style.Font.SetItalic().Font.SetFontColor(X(Muted));
        }

        var lastRow = HeaderRow + Math.Max(rowCount, 1);
        var table = sheet.Range(HeaderRow, 1, lastRow, headers.Length).CreateTable(name);
        table.Theme = XLTableTheme.None;
        table.ShowAutoFilter = true;

        var header = table.HeadersRow();
        HeaderStyle(header.Style);
        sheet.Row(HeaderRow).Height = 22;

        // Subtle banding (conditional fills for status columns layer on top).
        for (var r = HeaderRow + 2; r <= lastRow; r += 2)
        {
            sheet.Range(r, 1, r, headers.Length).Style.Fill.SetBackgroundColor(X(Panel));
        }
        table.DataRange.Style.Border.SetBottomBorder(XLBorderStyleValues.Hair).Border.SetBottomBorderColor(X(Line));
        table.DataRange.Style.Alignment.SetVertical(XLAlignmentVerticalValues.Center);

        sheet.SheetView.FreezeRows(HeaderRow);
        sheet.PageSetup.SetRowsToRepeatAtTop(HeaderRow, HeaderRow);
        return table;
    }

    private static void HeaderStyle(IXLStyle style)
    {
        style.Font.SetBold().Font.SetFontColor(X(Muted)).Fill.SetBackgroundColor(X(Raised));
        style.Border.SetBottomBorder(XLBorderStyleValues.Thin).Border.SetBottomBorderColor(X(LineStrong));
        style.Alignment.SetVertical(XLAlignmentVerticalValues.Center);
    }

    private static void Format(IXLTable table, int[] columns, string format)
    {
        foreach (var column in columns) table.DataRange.Column(column).Style.NumberFormat.Format = format;
    }

    private static void Center(IXLTable table, int[] columns)
    {
        foreach (var column in columns) table.DataRange.Column(column).Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
    }

    private static void Highlight(IXLRangeColumn column, string text, string fg, string bg) =>
        column.AddConditionalFormat().WhenEquals($"\"{text}\"")
            .Font.SetFontColor(X(fg)).Font.SetBold().Fill.SetBackgroundColor(X(bg));

    /// <summary>Live rules from the clinical thresholds: critical (red) takes priority over warning (amber).</summary>
    private static void ThresholdFormatting(IXLRangeColumn column, ThresholdResponse t)
    {
        static double D(decimal value) => (double)value;

        if (t.CriticalLow is { } cl) column.AddConditionalFormat().WhenLessThan(D(cl)).Font.SetFontColor(X(Critical)).Font.SetBold().Fill.SetBackgroundColor(X(CriticalSoft));
        if (t.CriticalHigh is { } ch) column.AddConditionalFormat().WhenGreaterThan(D(ch)).Font.SetFontColor(X(Critical)).Font.SetBold().Fill.SetBackgroundColor(X(CriticalSoft));
        if (t.WarningLow is { } wl) column.AddConditionalFormat().WhenLessThan(D(wl)).Font.SetFontColor(X(Caution)).Fill.SetBackgroundColor(X(CautionSoft));
        if (t.WarningHigh is { } wh) column.AddConditionalFormat().WhenGreaterThan(D(wh)).Font.SetFontColor(X(Caution)).Fill.SetBackgroundColor(X(CautionSoft));
    }

    private static void EwsFormatting(IXLRangeColumn column)
    {
        column.AddConditionalFormat().WhenEqualOrGreaterThan(EarlyWarningScore.HighRiskFrom)
            .Font.SetBold().Font.SetFontColor(X(Critical)).Fill.SetBackgroundColor(X(CriticalSoft));
        column.AddConditionalFormat().WhenEqualOrGreaterThan(EarlyWarningScore.MediumRiskFrom)
            .Font.SetBold().Font.SetFontColor(X(Caution)).Fill.SetBackgroundColor(X(CautionSoft));
    }

    /// <summary>Styles a small matrix (summary/statistics) that isn't an Excel table.</summary>
    private static void StyleMatrix(IXLWorksheet sheet, int headerRow, int lastRow, int columns, double[]? widths)
    {
        var header = sheet.Range(headerRow, 1, headerRow, columns);
        HeaderStyle(header.Style);
        sheet.Row(headerRow).Height = 22;

        var body = sheet.Range(headerRow + 1, 1, lastRow, columns);
        body.Style.Border.SetBottomBorder(XLBorderStyleValues.Hair).Border.SetBottomBorderColor(X(Line));
        sheet.Range(headerRow + 1, 1, lastRow, 1).Style.Font.SetBold();
        sheet.Range(headerRow + 1, 2, lastRow, columns).Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);

        if (widths is not null)
        {
            for (var c = 0; c < widths.Length; c++) sheet.Column(1 + c).Width = widths[c];
        }
    }

    private static void WriteThresholds(IXLWorksheet sheet, IReadOnlyList<ThresholdResponse> thresholds)
    {
        string[] headers = ["Metric", "Unit", "Warning low", "Warning high", "Critical low", "Critical high"];
        var table = Table(sheet, sheet.Name + "Table", headers, thresholds.Count, [24, 14, 13, 13, 13, 13]);
        for (var i = 0; i < thresholds.Count; i++)
        {
            var t = thresholds[i];
            var row = HeaderRow + 1 + i;
            sheet.Cell(row, 1).Value = t.Label;
            sheet.Cell(row, 2).Value = t.Unit;
            if (t.WarningLow is { } wl) sheet.Cell(row, 3).Value = (double)wl;
            if (t.WarningHigh is { } wh) sheet.Cell(row, 4).Value = (double)wh;
            if (t.CriticalLow is { } cl) sheet.Cell(row, 5).Value = (double)cl;
            if (t.CriticalHigh is { } ch) sheet.Cell(row, 6).Value = (double)ch;
        }
        Center(table, [3, 4, 5, 6]);
        table.DataRange.Column(3).Style.Font.SetFontColor(X(Caution));
        table.DataRange.Column(4).Style.Font.SetFontColor(X(Caution));
        table.DataRange.Column(5).Style.Font.SetFontColor(X(Critical));
        table.DataRange.Column(6).Style.Font.SetFontColor(X(Critical));
    }

    private static byte[] Save(XLWorkbook workbook)
    {
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
