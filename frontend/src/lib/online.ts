"use client";

import { useSyncExternalStore } from "react";

function subscribe(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

/** Browser connectivity. Assumed online during SSR/hydration. */
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
