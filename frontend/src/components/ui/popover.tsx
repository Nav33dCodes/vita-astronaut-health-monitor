"use client";

import clsx from "clsx";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";

/** Closes a floating element on outside pointer-down or Escape. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, close]);
}

/**
 * Anchored popover. `trigger` receives the open state and toggle props; the panel renders below
 * it, aligned to `align`.
 */
export function Popover({
  trigger,
  children,
  align = "end",
  width = "16rem",
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void; "aria-expanded": boolean; "aria-controls": string }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  width?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);

  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), "aria-expanded": open, "aria-controls": id })}
      {open && (
        <div
          id={id}
          style={{ width }}
          className={clsx(
            "surface-pop absolute top-full z-40 mt-1.5 max-w-[calc(100vw-1.5rem)] animate-pop-in rounded-xl p-1.5",
            align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            className,
          )}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-medium text-faint">{children}</p>;
}

export function MenuSeparator() {
  return <div className="-mx-1.5 my-1.5 h-px bg-line" />;
}
