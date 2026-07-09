/**
 * System-driven theming.
 *
 * The app's dark styling is delivered entirely through Tailwind `dark:` variants,
 * which are gated on `[data-theme="dark"]` on the <html> element (see
 * tailwind.config.js `darkMode`). We follow the OS setting via
 * `(prefers-color-scheme: dark)` — on iOS this tracks the system appearance
 * inside the Capacitor WKWebView, so no in-app toggle is needed.
 *
 * THEME_INIT_SCRIPT is injected as a raw inline <script> at the very top of
 * <head> so it runs before first paint and before React hydration, preventing a
 * light-then-dark flash. The <html> tag carries `suppressHydrationWarning`
 * because this script mutates `data-theme` before hydration.
 */

export type ResolvedTheme = 'light' | 'dark'

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function getSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light'
    return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light'
}

export function applyTheme(theme: ResolvedTheme): void {
    if (typeof document === 'undefined') return
    const el = document.documentElement
    el.setAttribute('data-theme', theme)
    el.style.colorScheme = theme
}

// Runs before paint to set the theme from the OS preference. Kept tiny and
// self-contained (no imports) because it is stringified into an inline script.
export const THEME_INIT_SCRIPT = `(function(){try{var d=window.matchMedia&&window.matchMedia('${DARK_MEDIA_QUERY}').matches;var t=d?'dark':'light';var e=document.documentElement;e.setAttribute('data-theme',t);e.style.colorScheme=t;}catch(_){}})();`
