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

const RISK_STYLE: Record<EarlyWarningRisk, string> = {
  Low: "border-nominal/30 bg-nominal/10 text-nominal",
  LowMedium: "border-caution/35 bg-caution/10 text-caution",
  Medium: "border-caution/50 bg-caution/15 text-caution",
  High: "border-critical/50 bg-critical/15 text-critical",
};

/** Compact early-warning score chip, e.g. "EWS 5 · Medium". */
export function EwsBadge({ score, risk, showLabel = false }: { score: number; risk: EarlyWarningRisk; showLabel?: boolean }) {
  return (
    <span
      title={`Early warning score ${score} — ${RISK_LABEL[risk]} risk`}
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap",
        RISK_STYLE[risk],
        risk === "High" && "animate-blink",
      )}
    >
      EWS {score}
      {showLabel && <span className="font-normal opacity-80">· {RISK_LABEL[risk]}</span>}
    </span>
  );
}

/** Escalation level chip for alerts that went unacknowledged. */
export function EscalationBadge({ level }: { level: number }) {
  if (level <= 0) return null;
  return (
    <span
      title={`Escalated to level ${level} — not acknowledged in time`}
      className="inline-flex items-center gap-1 rounded-md border border-critical/60 bg-critical px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-[0_0_12px_var(--color-critical)]"
    >
      ESC L{level}
    </span>
  );
}
