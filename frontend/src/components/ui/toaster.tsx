"use client";

import { CircleAlert, CircleCheck, Info, Loader2, OctagonAlert, type LucideIcon } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/lib/theme";

/** Small tinted icon; the colour comes from the toast type (see globals.css). */
function ToastIcon({ icon: Icon, spin = false }: { icon: LucideIcon; spin?: boolean }) {
  return (
    <span className="grid size-5 place-items-center text-[var(--toast-accent)]">
      <Icon className={spin ? "size-4 animate-spin" : "size-4"} aria-hidden strokeWidth={2.2} />
    </span>
  );
}

/**
 * Minimal notifications: bottom-right, at most three on screen, compact cards that pause while
 * hovered. What appears here is decided by lib/notify (critical events and the user's own actions).
 */
export function Toaster() {
  const { resolved } = useTheme();

  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      offset={{ bottom: 16, right: 16 }}
      // Above the mobile tab bar.
      mobileOffset={{ bottom: 76, left: 12, right: 12 }}
      gap={8}
      visibleToasts={3}
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
            "group relative flex w-[min(360px,calc(100vw-24px))] items-start gap-2.5 overflow-hidden rounded-xl border border-line bg-panel py-2.5 pr-8 pl-3 text-ink shadow-[var(--shadow-pop)]",
          icon: "mt-px shrink-0",
          content: "min-w-0 flex-1",
          title: "truncate text-[13px] leading-5 font-medium",
          description: "line-clamp-2 text-[12.5px] leading-snug text-muted",
          actionButton:
            "shrink-0 self-center rounded-md px-2 py-1 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/10",
          cancelButton: "shrink-0 self-center rounded-md px-2 py-1 text-[12px] font-medium text-muted hover:text-ink",
          closeButton:
            "!absolute !top-2 !right-2 !left-auto grid size-6 place-items-center rounded-md text-faint opacity-0 transition group-hover:opacity-100 hover:bg-overlay/[0.06] hover:text-ink focus-visible:opacity-100 [&_svg]:size-3.5",
        },
      }}
    />
  );
}
