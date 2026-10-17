import clsx from "clsx";
import { Loader2, SatelliteDish } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes } from "react";
import { forwardRef } from "react";

interface CardProps {
  className?: string;
  children: ReactNode;
  /** Adds HUD corner brackets. */
  hud?: boolean;
  tone?: "critical" | "caution";
}

export function Card({ className, children, hud, tone }: CardProps) {
  return (
    <section
      className={clsx(
        "glass rounded-2xl p-5",
        hud && "hud-frame",
        tone === "critical" && "glow-critical",
        tone === "caution" && "glow-caution",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="hud-label flex items-center gap-2">
        <span aria-hidden className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
        {children}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Tighter spacing for dashboards that must fit one screen. */
  compact?: boolean;
}) {
  return (
    <header className={clsx("flex flex-wrap items-end justify-between gap-4", compact ? "mb-4" : "mb-8")}>
      <div>
        {eyebrow && <p className="hud-label mb-2 !text-accent">{eyebrow}</p>}
        <h1 className={clsx("font-semibold tracking-tight text-ink", compact ? "text-2xl" : "text-3xl")}>{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink font-semibold shadow-[0_0_24px_-6px_var(--color-accent)] hover:shadow-[0_0_32px_-4px_var(--color-accent)] hover:brightness-110",
  secondary: "border border-line-strong bg-overlay/[0.03] text-ink hover:border-accent/50 hover:bg-accent/[0.06]",
  danger: "border border-critical/40 bg-critical/10 text-critical hover:bg-critical/20",
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
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const FIELD_CLASS =
  "h-10 w-full rounded-xl border border-line-strong bg-canvas/60 px-3 text-sm text-ink placeholder:text-faint transition focus:border-accent/70 focus:outline-none focus:ring-4 focus:ring-accent/10 aria-[invalid=true]:border-critical/70";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} {...props} className={clsx(FIELD_CLASS, className)} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} {...props} className={clsx(FIELD_CLASS, "cursor-pointer pr-8", className)}>
      {children}
    </select>
  );
});

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="hud-label !text-[10px]">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="block text-xs text-critical">
          {error}
        </span>
      ) : (
        hint && <span className="block text-xs text-faint">{hint}</span>
      )}
    </label>
  );
}

/** Segmented control for filters and tabs. */
export function Segmented<T extends string | number | undefined>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-xl border border-line bg-canvas/50 p-1">
      {options.map((option) => (
        <button
          key={option.label}
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition",
            value === option.value
              ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]"
              : "text-muted hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("animate-pulse rounded-xl bg-overlay/[0.04]", className)} />;
}

export function Spinner({ label = "Acquiring telemetry…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 font-mono text-xs tracking-wider text-muted" role="status">
      <Loader2 className="size-4 animate-spin text-accent" aria-hidden /> {label}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl border border-line bg-overlay/[0.02]">
        <SatelliteDish className="size-5 text-faint" aria-hidden />
      </span>
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="max-w-xs text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div role="alert" className="glass glow-critical rounded-2xl p-5 text-sm">
      <p className="hud-label !text-critical">Telemetry link lost</p>
      <p className="mt-2 text-ink/85">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Retry connection
        </Button>
      )}
    </div>
  );
}
