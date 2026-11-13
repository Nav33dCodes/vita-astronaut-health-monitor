export const SLEEP_CAUTION = 6;
export const SLEEP_CRITICAL = 5;

export const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
