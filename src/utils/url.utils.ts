import { BASE_URL } from '@/constants/general.consts'
import { isCapacitor } from '@/utils/capacitor'

/** Absolute URL for sharing. On web, uses the current origin so staging shares
 *  stay on staging. In Capacitor the WebView origin is `https://localhost`
 *  (useless in a shared link), so always use the public BASE_URL there.
 *  Falls back to BASE_URL on SSR. */
export function shareableUrl(path: `/${string}`): string {
    const base = typeof window !== 'undefined' && !isCapacitor() ? window.location.origin : BASE_URL
    return `${base}${path}`
}
