import clsx from "clsx";
import type { HealthStatus } from "@/lib/api/types";
import { HEALTH_TEXT } from "./badges";

/** Neutral initials avatar with a small status dot, the way people lists look in enterprise tools. */
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
  return (
    <span
      aria-hidden
      className={clsx(
        "relative grid shrink-0 place-items-center rounded-full bg-panel-raised font-semibold text-ink ring-1 ring-line ring-inset",
        size === "sm" && "size-8 text-[11px]",
        size === "md" && "size-10 text-[12.5px]",
        size === "lg" && "size-16 text-lg",
      )}
    >
      {firstName[0]}
      {lastName[0]}
      <span
        className={clsx(
          "absolute right-0 bottom-0 rounded-full bg-current ring-2 ring-panel",
          size === "lg" ? "size-3.5" : "size-2.5",
          HEALTH_TEXT[status],
          status === "Unknown" && "!text-faint",
        )}
      />
    </span>
  );
}
