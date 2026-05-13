import { BASE_URL } from '@/constants/general.consts'

/** Absolute URL on the current origin so staging shares stay on staging.
 *  Falls back to BASE_URL on SSR. */
export function shareableUrl(path: `/${string}`): string {
    const base = typeof window !== 'undefined' ? window.location.origin : BASE_URL
    return `${base}${path}`
}
