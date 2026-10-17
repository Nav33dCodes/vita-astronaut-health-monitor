import clsx from "clsx";
import type { HealthStatus } from "@/lib/api/types";
import { HEALTH_COLOR } from "./badges";

/** Initials avatar with a status-coloured halo ring. */
export function CrewAvatar({
  firstName,
  lastName,
  status,
  size = "md",
}: {
  firstName: string;
  lastName: string;
  status: HealthStatus;
  size?: "sm" | "md" | "lg";
}) {
  const color = HEALTH_COLOR[status];
  return (
    <span
      aria-hidden
      className={clsx(
        "relative grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-panel-raised to-canvas font-mono font-semibold text-ink",
        size === "sm" && "size-8 text-[10px]",
        size === "md" && "size-11 text-xs",
        size === "lg" && "size-20 text-xl",
        status === "Critical" && "animate-pulse-ring",
      )}
      style={{ boxShadow: `0 0 0 2px ${color}, 0 0 18px -2px color-mix(in srgb, ${color} 55%, transparent)` }}
    >
      {firstName[0]}
      {lastName[0]}
    </span>
  );
}
