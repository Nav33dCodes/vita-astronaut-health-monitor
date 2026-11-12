"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button, IconButton } from "./primitives";

/** Opens/closes a native <dialog> from a boolean (focus trap, Esc and top layer for free). */
function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return ref;
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "md" | "lg";
}

export function Dialog({ open, onClose, title, description, children, size = "md" }: DialogProps) {
  const ref = useModal(open);
  const titleId = useId();

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={titleId}
      className={clsx(
        "surface-pop m-auto max-h-[calc(100dvh-2rem)] rounded-xl p-0 text-ink open:animate-pop-in",
        size === "lg" ? "w-[min(44rem,calc(100vw-2rem))]" : "w-[min(32rem,calc(100vw-2rem))]",
      )}
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-1">
        <div>
          <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
        </div>
        <IconButton onClick={onClose} aria-label="Close dialog" className="-mt-1 -mr-1">
          <X />
        </IconButton>
      </div>
      <div className="px-5 pt-4 pb-5">{open && children}</div>
    </dialog>
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Visible title; pass `label` instead for drawers that render their own header. */
  title?: ReactNode;
  label?: string;
  side?: "right" | "left";
  width?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}

/** Side sheet for details and navigation. Keeps the page underneath, so context is never lost. */
export function Drawer({ open, onClose, title, label, side = "right", width = "28rem", headerAction, children }: DrawerProps) {
  const ref = useModal(open);
  const titleId = useId();

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : label}
      style={{ width: `min(${width}, 100vw)` }}
      className={clsx(
        "fixed inset-y-0 m-0 h-dvh max-h-dvh max-w-none border-line bg-panel p-0 text-ink shadow-[var(--shadow-pop)]",
        side === "right" ? "right-0 left-auto border-l open:animate-slide-in-right" : "right-auto left-0 border-r open:animate-slide-in-left",
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          {title && (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-5">
              <h2 id={titleId} className="min-w-0 truncate text-[14px] font-semibold">
                {title}
              </h2>
              <div className="flex items-center gap-1">
                {headerAction}
                <IconButton onClick={onClose} aria-label="Close panel">
                  <X />
                </IconButton>
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      )}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Replacement for window.confirm with consistent styling. */
export function ConfirmDialog({ open, title, message, confirmLabel, loading, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <div className="text-[13.5px] text-muted">{message}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm} className="!bg-critical-solid !text-white hover:!opacity-90">
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
