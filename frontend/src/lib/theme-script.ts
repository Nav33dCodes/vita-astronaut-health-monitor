// Shared by the client theme store and the server layout (no "use client" here).
export const THEME_STORAGE_KEY = "vita:theme";
export const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** Runs before first paint so the page never flashes the wrong theme. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var t=p==="system"?(matchMedia("${LIGHT_QUERY}").matches?"light":"dark"):p;var e=document.documentElement;e.dataset.theme=t;e.style.colorScheme=t;}catch(_){document.documentElement.dataset.theme="dark";}})();`;
