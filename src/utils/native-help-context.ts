const NATIVE_HELP_PARAM = 'fromNativeApp'
const NATIVE_HELP_SESSION_KEY = 'peanut:native-help'

/** The browser sheet has no Capacitor bridge; carry the app context explicitly. */
export function withNativeHelpContext(href: string): string {
    try {
        const url = new URL(href)
        const appOrigin = new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me').origin
        const isPeanut = /^(.*\.)?peanut\.me$/.test(url.hostname) || url.origin === appOrigin
        const isHelp = /^\/(?:[^/]+\/)?help(?:\/|$)/.test(url.pathname)
        if (url.protocol !== 'https:' || !isPeanut || !isHelp) return href
        url.searchParams.set(NATIVE_HELP_PARAM, '1')
        return url.href
    } catch {
        return href
    }
}

/**
 * The native export renders every app link with a trailing slash
 * (`trailingSlash: true`), so a tap on `/en/help` asks the sheet for
 * `/en/help/`. The website is slashless and redirects.json 308s the locale tree
 * back, and once peanut.me's service worker controls the sheet, iOS 16 Safari
 * fails a navigation whose worker response followed a redirect: "Response
 * served by service worker has redirections". Open the slashless page directly.
 *
 * The website's own origins only — other peanut.me hosts (the API, attachment
 * storage) keep whatever path they were given.
 */
export function withoutTrailingSlash(href: string): string {
    try {
        const url = new URL(href)
        const appOrigin = new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me').origin
        const isWebsite = url.origin === 'https://peanut.me' || url.origin === appOrigin
        if (!isWebsite || url.pathname === '/' || !url.pathname.endsWith('/')) return href
        url.pathname = url.pathname.replace(/\/+$/, '')
        return url.href
    } catch {
        return href
    }
}

let nativeHelpDocument = false

/**
 * Presentation only, never authentication. Keep the context within this tab so
 * article links, locale changes and reloads retain it without affecting other
 * browser visits. The document fallback also works when storage is blocked.
 */
export function isNativeHelpContext(): boolean {
    if (typeof window === 'undefined') return false
    if (new URLSearchParams(window.location.search).get(NATIVE_HELP_PARAM) === '1') {
        nativeHelpDocument = true
        try {
            sessionStorage.setItem(NATIVE_HELP_SESSION_KEY, '1')
        } catch {}
    }
    try {
        return nativeHelpDocument || sessionStorage.getItem(NATIVE_HELP_SESSION_KEY) === '1'
    } catch {
        return nativeHelpDocument
    }
}
