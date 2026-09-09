import { BASE_URL } from '@/constants/general.consts'
import { isCapacitor } from '@/utils/capacitor'

/** Canonical origin for links shared or handed to the backend. On web, uses the
 *  current origin so staging stays on staging. In Capacitor the WebView origin is
 *  `https://localhost` (useless outside the app), so use the public BASE_URL there.
 *  Falls back to BASE_URL on SSR. */
export function appBaseUrl(): string {
    return typeof window !== 'undefined' && !isCapacitor() ? window.location.origin : BASE_URL
}

/** Absolute URL for sharing. */
export function shareableUrl(path: `/${string}`): string {
    return `${appBaseUrl()}${path}`
}

/**
 * Absolute URL for a shareable payment link — a request link, an IRL request QR,
 * or a receipt share.
 *
 * Lives under `/pay/` rather than the root `/<recipient>` catch-all because the
 * root namespace is shared with the marketing site: neither the AASA nor the
 * Android intent filter can claim `/*` without also swallowing every blog, help
 * and locale page, so a root-shaped link opened in the browser even when the app
 * was installed. `/pay` + `/pay/*` is already claimed on both platforms.
 *
 * `path` is everything after `/pay` — it must start with a slash.
 */
export function payLinkUrl(path: `/${string}`): string {
    return shareableUrl(`/pay${path}`)
}
