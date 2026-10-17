import clsx from "clsx";
import Image from "next/image";
import logoMark from "@/assets/logo-mark.png";
import { BRAND } from "@/lib/brand";

/*
 * Brand assets are generated from the source logo (docs/assets/logo-source.png) by
 * frontend/scripts/make_icons.py — re-run it after changing the logo.
 */

/** The pulse mark. Static import → Next serves it resized, as WebP/AVIF, with no layout shift. */
export function LogoMark({ height = 32, className }: { height?: number; className?: string }) {
  return (
    <Image
      src={logoMark}
      alt=""
      height={height}
      priority
      className={clsx("shrink-0 drop-shadow-[0_4px_14px_rgb(252_83_85/0.35)]", className)}
    />
  );
}

/** Mark + wordmark lockup. */
export function Logo({ showTagline = true, className }: { showTagline?: boolean; className?: string }) {
  return (
    <span className={clsx("flex items-center gap-3", className)}>
      <LogoMark />
      <span className="leading-none">
        <span className="block text-[17px] font-semibold tracking-[0.28em] text-ink">{BRAND.name}</span>
        {showTagline && <span className="hud-label mt-1.5 block !text-[9px] !tracking-[0.14em]">{BRAND.tagline}</span>}
      </span>
    </span>
  );
}
