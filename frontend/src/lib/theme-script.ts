// Shared by the client theme store and the server layout (no "use client" here).
export const THEME_STORAGE_KEY = "vita:theme";
export const SIDEBAR_STORAGE_KEY = "vita:sidebar";
export const DENSITY_STORAGE_KEY = "vita:density";
export const LIGHT_QUERY = "(prefers-color-scheme: light)";
/** Light is the product default; "system" and "dark" are opt-in. */
export const DEFAULT_THEME = "light";

/**
 * Runs before first paint so the page never flashes the wrong theme, sidebar width or density.
 */
export const THEME_INIT_SCRIPT = `(function(){var e=document.documentElement;try{var p=localStorage.getItem("${THEME_STORAGE_KEY}")||"${DEFAULT_THEME}";var t=p==="system"?(matchMedia("${LIGHT_QUERY}").matches?"light":"dark"):p;e.dataset.theme=t;e.style.colorScheme=t;if(localStorage.getItem("${SIDEBAR_STORAGE_KEY}")==="collapsed")e.dataset.sidebar="collapsed";var d=localStorage.getItem("${DENSITY_STORAGE_KEY}");if(d==="compact")e.dataset.density="compact";}catch(_){e.dataset.theme="${DEFAULT_THEME}";}})();`;
