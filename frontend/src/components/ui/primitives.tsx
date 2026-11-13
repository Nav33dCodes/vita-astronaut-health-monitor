import clsx from "clsx";
import { Check, Inbox, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes } from "react";
import { forwardRef } from "react";

// ---- Surfaces -----------------------------------------------------------------

interface CardProps {
  className?: string;
  children: ReactNode;
  /** @deprecated HUD decoration was removed; kept so older call sites still compile. */
  hud?: boolean;
  tone?: "critical" | "caution";
}

export function Card({ className, children, tone }: CardProps) {
  return (
    <section
      className={clsx(
        "glass rounded-[var(--radius-card)] p-5",
        tone === "critical" && "glow-critical",
        tone === "caution" && "glow-caution",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  action,
  description,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mb-4 flex min-h-7 flex-wrap items-start justify-between gap-x-3 gap-y-2", className)}>
      <div className="min-w-[min(100%,14rem)] flex-1">
        <h2 className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.005em] text-ink">{children}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** Small muted count shown next to a card or page title. */
export function Count({ children }: { children: ReactNode }) {
  return (
    <span className="tnum rounded-md bg-panel-raised px-1.5 py-px text-[11.5px] font-medium text-muted">{children}</span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  compact = false,
}: {
  /** Short context line above the title, e.g. "Monitoring". */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <header className={clsx("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", compact ? "mb-5" : "mb-6")}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[12.5px] font-medium text-muted">{eyebrow}</p>}
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[13.5px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

// ---- Buttons ------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_0_0/0.12)] hover:bg-[color-mix(in_srgb,var(--color-accent)_90%,black)]",
  secondary: "border border-line-strong bg-panel text-ink shadow-[var(--shadow-sm)] hover:bg-panel-raised",
  danger: "border border-critical/30 bg-panel text-critical hover:bg-critical/[0.06]",
  ghost: "text-muted hover:bg-overlay/[0.05] hover:text-ink",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-[background-color,color,border-color,transform] duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:shrink-0",
        size === "sm" ? "h-8 px-2.5 text-[12.5px]" : "h-9 px-3.5 text-[13px]",
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Square icon-only button. Always pass an aria-label. */
export function IconButton({
  className,
  active,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      {...props}
      className={clsx(
        "grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
        active ? "bg-accent/10 text-accent" : "text-muted hover:bg-overlay/[0.06] hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={clsx(
        "inline-grid h-5 min-w-5 place-items-center rounded-[5px] border border-line-strong bg-panel px-1 font-sans text-[10.5px] font-medium text-muted shadow-[0_1px_0_var(--color-line-strong)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

// ---- Form controls ------------------------------------------------------------

const FIELD_CLASS =
  "h-9 rounded-lg border border-line-strong bg-panel px-3 text-[13px] text-ink shadow-[var(--shadow-sm)] placeholder:text-faint transition-[border-color,box-shadow] duration-150 hover:border-[color-mix(in_srgb,var(--color-line-strong)_60%,var(--color-muted))] focus:border-accent focus:ring-[3px] focus:ring-accent/15 focus:outline-none aria-[invalid=true]:border-critical/70";

/** Full width unless the caller sets its own width (no tailwind-merge here, so avoid conflicts). */
const widthOf = (className: string | undefined) => (/(^|\s)(w-|min-w-|max-w-)/.test(className ?? "") ? undefined : "w-full");

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} {...props} className={clsx(FIELD_CLASS, widthOf(className), className)} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      {...props}
      className={clsx(
        FIELD_CLASS,
        widthOf(className),
        "select-chevron cursor-pointer appearance-none pr-8",
        className,
      )}
    >
      {children}
    </select>
  );
});

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[12.5px] font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="block text-xs text-critical">
          {error}
        </span>
      ) : (
        hint && <span className="block text-xs text-muted">{hint}</span>
      )}
    </label>
  );
}

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={clsx(
        "grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors duration-100",
        on ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-panel hover:border-muted",
        className,
      )}
    >
      {indeterminate ? <span className="h-0.5 w-2 rounded-full bg-current" /> : checked && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}

/** Segmented control for filters and tabs. */
export function Segmented<T extends string | number | boolean | undefined>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={clsx("inline-flex max-w-full overflow-x-auto rounded-lg bg-panel-raised p-0.5 ring-1 ring-line ring-inset", size === "sm" ? "h-8" : "h-9")}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.label}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              "flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150",
              size === "sm" ? "px-2.5 text-xs" : "px-3 text-[12.5px]",
              active ? "bg-panel text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--color-line)]" : "text-muted hover:text-ink",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={clsx("tnum text-[11px]", active ? "text-muted" : "text-faint")}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---- Feedback -----------------------------------------------------------------

/** Re-exported so existing imports keep working; see components/ui/skeleton.tsx for the kit. */
export { Skeleton } from "./skeleton";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <span className="mb-1 grid size-10 place-items-center rounded-full bg-panel-raised text-faint [&_svg]:size-[18px]">
        {icon ?? <Inbox aria-hidden />}
      </span>
      <p className="text-[13.5px] font-medium text-ink">{title}</p>
      {children && <div className="max-w-sm text-[13px] text-muted">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div role="alert" className="glass flex items-start gap-3 rounded-[var(--radius-card)] p-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-critical/10 text-critical">
        <TriangleAlert className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-ink">Couldn&apos;t load this data</p>
        <p className="mt-0.5 text-[13px] text-muted">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCcw className="size-3.5" aria-hidden /> Retry
        </Button>
      )}
    </div>
  );
}
