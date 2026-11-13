import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="tnum font-mono text-[13px] font-medium text-faint">404</p>
        <h1 className="mt-2 text-[17px] font-semibold tracking-tight text-ink">Page not found</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">This page doesn&apos;t exist or has moved. Use search (Ctrl K) to find a crew member or page.</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-[13px] font-medium text-accent-ink transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_90%,black)]"
        >
          Go to overview
        </Link>
      </div>
    </div>
  );
}
