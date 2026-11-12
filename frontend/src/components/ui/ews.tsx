import clsx from "clsx";
import type { EarlyWarningRisk } from "@/lib/api/types";

export const RISK_LABEL: Record<EarlyWarningRisk, string> = {
  Low: "Low",
  LowMedium: "Low–medium",
  Medium: "Medium",
  High: "High",
};

/** Text colour per risk band (theme tokens). */
export const RISK_TEXT: Record<EarlyWarningRisk, string> = {
  Low: "text-nominal",
  LowMedium: "text-caution",
  Medium: "text-caution",
  High: "text-critical",
};

/** Solid colour per risk band, for bars and dots. */
export const RISK_BG: Record<EarlyWarningRisk, string> = {
  Low: "bg-nominal",
  LowMedium: "bg-caution",
  Medium: "bg-caution",
  High: "bg-critical",
};

const RISK_STYLE: Record<EarlyWarningRisk, string> = {
  Low: "bg-nominal/[0.08] text-nominal ring-nominal/20",
  LowMedium: "bg-caution/[0.08] text-caution ring-caution/20",
  Medium: "bg-caution/[0.1] text-caution ring-caution/25",
  High: "bg-critical/[0.1] text-critical ring-critical/25",
};

/** Compact early-warning score chip, e.g. "EWS 5 · Medium". */
export function EwsBadge({ score, risk, showLabel = false }: { score: number; risk: EarlyWarningRisk; showLabel?: boolean }) {
  return (
    <span
      title={`Early warning score ${score} — ${RISK_LABEL[risk]} risk`}
      className={clsx(
        "tnum inline-flex h-[22px] items-center gap-1 rounded-md px-1.5 text-[11.5px] font-semibold whitespace-nowrap ring-1 ring-inset",
        RISK_STYLE[risk],
      )}
    >
      EWS {score}
      {showLabel && <span className="font-medium opacity-80">· {RISK_LABEL[risk]}</span>}
    </span>
  );
}

/** Escalation level chip for alerts that went unacknowledged. */
export function EscalationBadge({ level }: { level: number }) {
  if (level <= 0) return null;
  return (
    <span
      title={`Escalated to level ${level}: not acknowledged in time`}
      className="inline-flex h-[22px] items-center gap-1 rounded-md bg-critical-solid px-1.5 text-[11.5px] font-semibold whitespace-nowrap text-white"
    >
      Escalated · L{level}
    </span>
  );
}
