import { TRACKED_LINK_ORIGIN } from '@/features/tracked-links/contract'

/**
 * Short links: peanut.me/go/<key> answers a 307 to the path on the right.
 *
 * To add one, add a line such as `'lisbon/flyer': '/en/send-money-to-brazil?utm_source=flyer',`.
 * - The key is everything after /go/: lowercase letters, digits, `-` and `_`, segments joined by `/`.
 * - The value is a path on peanut.me that starts with `/`. Query and hash are fine.
 *   Never a full URL or another site, and never a /go/ path. go-map.test.ts fails on a bad line.
 * - A key wins over a creator with the same username: `konrad/1` here would take over Konrad's /go link.
 * - The visitor's own query string is dropped.
 */
export const GO_REDIRECTS: Readonly<Record<string, string>> = {
    app: '/app',
}

export const GO_REDIRECT_KEY = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/

/** The destination of /go/<segments>, or null when no key matches or its path is not ours. */
export function resolveGoRedirect(segments: string[], redirects = GO_REDIRECTS): string | null {
    const key = segments.join('/').toLowerCase()
    // Keys such as `constructor` must not read the object prototype.
    if (!Object.prototype.hasOwnProperty.call(redirects, key)) return null
    return goRedirectDestination(redirects[key])
}

/** The same-origin path a destination resolves to, or null when it leaves peanut.me or loops into /go/. */
export function goRedirectDestination(target: string): string | null {
    try {
        const url = new URL(target, TRACKED_LINK_ORIGIN)
        if (!target.startsWith('/') || url.origin !== TRACKED_LINK_ORIGIN || url.username || url.password) return null
        // The router decodes the path again, so `/%2Fevil.com` must not become //evil.com there.
        const path = decodeURIComponent(url.pathname)
        if (/^\/[\\/]/.test(path) || /^\/go(\/|$)/i.test(path)) return null
        return url.pathname + url.search + url.hash
    } catch {
        return null
    }
}
