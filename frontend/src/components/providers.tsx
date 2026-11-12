"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClientRestore, persistQueryClientSubscribe } from "@tanstack/react-query-persist-client";
import { useEffect, useState, type ReactNode } from "react";
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
            // Don't retry client errors such as 404, only transient failures. 499 ("request
            // cancelled" server-side, e.g. a dropped DB call) is transient, so it is retried.
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 499) && failureCount < 2,
          },
        },
      }),
  );

  useDeferredPersistence(client);

  return (
    <QueryClientProvider client={client}>
      <RealtimeProvider>{children}</RealtimeProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

/**
 * Restores the browser-cached queries only once the page has finished hydrating, then keeps the
 * cache saved. Pages stream in and hydrate in several passes; restoring earlier (as the stock
 * PersistQueryClientProvider does) hands late-hydrating pages data the server never rendered,
 * which is a hydration mismatch. Restoring a beat later still beats the network on revisits,
 * and hydrate() never overwrites data that is newer than the cached copy.
 */
function useDeferredPersistence(client: QueryClient) {
  useEffect(() => {
    const options = { ...createPersistOptions(), queryClient: client };
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const restore = () => {
      if (cancelled) return;
      void persistQueryClientRestore(options).finally(() => {
        if (!cancelled) unsubscribe = persistQueryClientSubscribe(options);
      });
    };
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(restore, { timeout: 500 });
      else setTimeout(restore, 50);
    };

    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", whenIdle);
      unsubscribe?.();
    };
  }, [client]);
}
