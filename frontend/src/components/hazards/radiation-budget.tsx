import clsx from "clsx";
import type { RadiationBudget } from "@/lib/api/types";

/** Mission dose against the career limit, as a bar with the 80% caution mark. */
export function RadiationBudgetBar({ budget, compact = false }: { budget: RadiationBudget; compact?: boolean }) {
  const pct = Math.min(100, budget.percentOfLimit);
  const tone = budget.percentOfLimit >= 100 ? "bg-critical" : budget.percentOfLimit >= 80 ? "bg-caution" : "bg-accent";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className={clsx("font-semibold tracking-tight text-ink", compact ? "text-[15px]" : "text-[22px]")}>
          <span className="tnum">{budget.missionDoseMsv.toFixed(1)}</span>
          <span className="ml-1 text-[12px] font-normal tracking-normal text-muted">mSv this mission</span>
        </p>
        <p className="tnum text-[12px] text-muted">
          {budget.percentOfLimit.toFixed(1)}% of {budget.careerLimitMsv} mSv
        </p>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-track" aria-hidden>
        <div className={clsx("h-full rounded-full transition-[width] duration-700 ease-out", tone)} style={{ width: `${Math.max(pct, 0.8)}%` }} />
        <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-line-strong" style={{ left: "80%" }} title="80% caution mark" />
      </div>
      {!compact && (
        <p className="mt-2 text-[12px] text-muted">
          {budget.currentRateMsvPerDay !== null ? (
            <>
              Current rate <span className="tnum text-ink">{budget.currentRateMsvPerDay.toFixed(2)} mSv/day</span>
              {budget.daysToLimitAtCurrentRate !== null && (
                <>
                  {" "}
                  · career limit reached in <span className="tnum text-ink">{budget.daysToLimitAtCurrentRate.toLocaleString()} days</span> at this rate
                </>
              )}
            </>
          ) : (
            "No dosimeter rate reported yet"
          )}
        </p>
      )}
    </div>
  );
}
