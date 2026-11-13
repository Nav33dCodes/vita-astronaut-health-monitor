"use client"; // Error boundaries must be Client Components

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/primitives";

/** Catches unexpected rendering errors in a page while the shell (sidebar, top bar) keeps working. */
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error instanceof Error ? error.message : "An unexpected error occurred.";

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-critical/10 text-critical">
          <TriangleAlert className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-[17px] font-semibold tracking-tight text-ink">This page couldn&apos;t load</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">
          Live monitoring continues in the background. Try again, or go back to the overview.
        </p>
        <p className="mx-auto mt-3 max-w-sm truncate rounded-md bg-panel-raised px-2.5 py-1.5 font-mono text-[11.5px] text-faint" title={message}>
          {message}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={retry}>
            <RotateCcw className="size-3.5" aria-hidden /> Try again
          </Button>
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-[13px] font-medium text-accent-ink transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_90%,black)]"
          >
            Go to overview
          </Link>
        </div>
      </div>
    </div>
  );
}
