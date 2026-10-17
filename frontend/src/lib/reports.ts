import type { ExportOption } from "@/components/ui/export-menu";
import { withQuery } from "./api/client";
import type { AlertSeverity, AlertStatus } from "./api/types";

/** Catalogue of server-generated reports, shared by every page that offers exports. */
export const reports = {
  fleetPdf: (): ExportOption => ({
    label: "Fleet health report",
    description: "KPIs, every crew member's status and vitals, open alerts and missions.",
    format: "PDF",
    path: "/api/v1/reports/fleet.pdf",
    fallbackName: "vita-fleet-report.pdf",
  }),
  crewExcel: (): ExcelOption => ({
    label: "Crew roster",
    description: "Latest vitals and early warning per astronaut, with threshold highlighting.",
    format: "Excel",
    path: "/api/v1/reports/crew.xlsx",
    fallbackName: "vita-crew-roster.xlsx",
  }),
  alertsExcel: (status?: AlertStatus, severity?: AlertSeverity): ExcelOption => ({
    label: "Alerts workbook",
    description: "Alerts matching the current filters, plus a live summary sheet.",
    format: "Excel",
    path: withQuery("/api/v1/reports/alerts.xlsx", { status, severity }),
    fallbackName: "vita-alerts.xlsx",
  }),
  astronautPdf: (id: string, hours: number): ExportOption => ({
    label: "Medical report",
    description: `Vitals, trend charts, statistics, early warning and alerts — last ${hours}h.`,
    format: "PDF",
    path: withQuery(`/api/v1/reports/astronauts/${id}.pdf`, { hours }),
    fallbackName: "vita-medical-report.pdf",
  }),
  vitalsExcel: (id: string, hours: number): ExcelOption => ({
    label: "Vitals workbook",
    description: `Every reading of the last ${hours}h with statistics and highlighting.`,
    format: "Excel",
    path: withQuery(`/api/v1/reports/astronauts/${id}/vitals.xlsx`, { hours }),
    fallbackName: "vita-vitals.xlsx",
  }),
};

type ExcelOption = ExportOption & { format: "Excel" };
