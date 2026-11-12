"use client";

import clsx from "clsx";
import { BRAND } from "@/lib/brand";
import { useLinkStatus, type LinkState } from "@/lib/realtime/store";

const DOT: Record<LinkState, { className: string; label: string }> = {
  connected: { className: "bg-nominal", label: "Live" },
  connecting: { className: "bg-caution", label: "Connecting" },
  reconnecting: { className: "bg-caution", label: "Reconnecting" },
  disconnected: { className: "bg-critical", label: "Offline" },
};

/**
 * The VITA wordmark: pure type, no logo. Wide-tracked Inter at a heavy-ish weight, with the
 * full stop doubling as the live uplink indicator. Collapses to "V." in the narrow sidebar.
 */
export function Wordmark({ className }: { className?: string }) {
  const link = useLinkStatus();
  const dot = DOT[link.state];

  return (
    <span className={clsx("inline-flex items-baseline select-none", className)} title={`${BRAND.name} · uplink ${dot.label.toLowerCase()}`}>
      <span className="text-[17px] leading-none font-[680] tracking-[0.34em] text-ink">
        V<span className="collapsed:hidden">ITA</span>
      </span>
      <span
        aria-hidden
        className={clsx(
          "-ml-[0.2em] inline-block size-[5px] translate-y-[-1px] rounded-full transition-colors duration-500",
          dot.className,
          link.state !== "connected" && "animate-blink",
        )}
      />
      <span className="sr-only">
        {BRAND.name}, uplink {dot.label}
      </span>
    </span>
  );
}
