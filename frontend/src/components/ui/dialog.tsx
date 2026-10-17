"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./primitives";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/** Accessible modal built on the native <dialog> element (focus trap + Esc for free). */
export function Dialog({ open, onClose, title, description, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className="glass glass-blur hud-frame m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl p-0 text-ink backdrop:bg-scrim backdrop:backdrop-blur-sm open:animate-fade-up"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div>
          <h2 id="dialog-title" className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted transition hover:bg-overlay/5 hover:text-ink"
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="p-6">{open && children}</div>
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
      <div className="text-sm text-muted">{message}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
