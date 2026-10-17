"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState, type ReactNode } from "react";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { Toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { PERSIST_MAX_AGE_MS, createPersistOptions } from "@/lib/query-persistence";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            // Unused entries stay in memory as long as they may be persisted, so the browser
            // cache isn't pruned early (TanStack Query requirement for persistence).
            gcTime: PERSIST_MAX_AGE_MS,
            // Don't retry client errors such as 404 — only transient failures.
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
          },
        },
      }),
  );
  const [persistOptions] = useState(createPersistOptions);

  return (
    <PersistQueryClientProvider client={client} persistOptions={persistOptions}>
      <RealtimeProvider>{children}</RealtimeProvider>
      <Toaster />
    </PersistQueryClientProvider>
  );
}
