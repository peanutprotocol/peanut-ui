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
