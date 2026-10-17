"use client";

import { CircleAlert, CircleCheck, Info, Loader2, OctagonAlert, type LucideIcon } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/lib/theme";

/** Icon chip tinted with the toast's accent colour (set per type in globals.css). */
function ToastIcon({ icon: Icon, spin = false }: { icon: LucideIcon; spin?: boolean }) {
  return (
    <span className="grid size-8 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--toast-accent)_13%,transparent)] text-[var(--toast-accent)]">
      <Icon className={spin ? "size-4 animate-spin" : "size-4"} aria-hidden />
    </span>
  );
}

/**
 * Premium, minimal notifications: frosted card, type-coloured accent rail and icon chip,
 * crisp typography, unobtrusive close button. Fully themed (light/dark) via design tokens.
 */
export function Toaster() {
  const { resolved } = useTheme();

  return (
    <Sonner
      theme={resolved}
      position="top-right"
      offset={{ top: 72, right: 20 }}
      mobileOffset={{ top: 64 }}
      gap={10}
      visibleToasts={4}
      closeButton
      icons={{
        success: <ToastIcon icon={CircleCheck} />,
        error: <ToastIcon icon={OctagonAlert} />,
        warning: <ToastIcon icon={CircleAlert} />,
        info: <ToastIcon icon={Info} />,
        loading: <ToastIcon icon={Loader2} spin />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "vita-toast group relative flex w-[min(380px,calc(100vw-32px))] items-start gap-3 overflow-hidden rounded-2xl border border-line bg-panel/90 py-3.5 pr-9 pl-4 text-ink shadow-[0_18px_44px_-18px_rgb(0_0_0/0.5)] backdrop-blur-xl",
          icon: "shrink-0",
          content: "min-w-0 flex-1 pt-0.5",
          title: "text-[13px] leading-snug font-semibold tracking-tight",
          description: "mt-0.5 text-xs leading-relaxed text-muted",
          actionButton:
            "shrink-0 self-center rounded-lg bg-[color-mix(in_srgb,var(--toast-accent)_14%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--toast-accent)] transition hover:bg-[color-mix(in_srgb,var(--toast-accent)_24%,transparent)]",
          cancelButton: "shrink-0 self-center rounded-lg px-2.5 py-1 text-xs font-medium text-muted hover:text-ink",
          closeButton:
            "!absolute !top-2.5 !right-2.5 !left-auto grid size-6 place-items-center rounded-lg text-faint opacity-0 transition group-hover:opacity-100 hover:bg-overlay/[0.06] hover:text-ink focus-visible:opacity-100 [&_svg]:size-3.5",
        },
      }}
    />
  );
}
