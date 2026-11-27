/**
 * Short links: peanut.me/go/<key> answers a 307 to the path on the right.
 * Rules: mono engineering/ui/tracked-links.md § Redirect map.
 *
 * To add one, add a line such as `'lisbon/flyer': '/en/send-money-to/brazil?utm_source=flyer',`.
 * - The key is everything after /go/: lowercase letters, digits, `-` and `_`, segments joined by `/`.
 * - The value is a path on peanut.me that starts with `/`. Query and hash are fine.
 *   Never a full URL or another site, and never a /go/ path. go-map.test.ts fails on a bad line.
 * - A path that is not a key answers 404.
 * - The visitor's own query string is dropped.
 * - In production redirects.json answers first. go-map.test.ts fails on a key redirects.json takes.
 */
export const GO_REDIRECTS: Readonly<Record<string, string>> = {
    app: '/app',
    // Palermo posters (TASK-24170). Printed QR codes: never remove a key, only change its value.
    'palermo/1':
        '/invite?code=squirrel&utm_source=poster&utm_medium=cpm&utm_campaign=palermo-posters-2026-11&utm_content=p1',
    'palermo/2':
        '/invite?code=squirrel&utm_source=poster&utm_medium=cpm&utm_campaign=palermo-posters-2026-11&utm_content=p2',
    'palermo/3':
        '/invite?code=squirrel&utm_source=poster&utm_medium=cpm&utm_campaign=palermo-posters-2026-11&utm_content=p3',
}

const ORIGIN = 'https://peanut.me'

/** The destination of /go/<segments>, or null when no key matches or its path is not ours. */
export function resolveGoRedirect(segments: string[]): string | null {
    const key = segments.join('/').toLowerCase()
    // Keys such as `constructor` must not read the object prototype.
    if (!Object.prototype.hasOwnProperty.call(GO_REDIRECTS, key)) return null
    return goRedirectDestination(GO_REDIRECTS[key])
}

/** The same-origin path a destination resolves to, or null when it leaves peanut.me or loops into /go/. */
export function goRedirectDestination(target: string): string | null {
    try {
        const url = new URL(target, ORIGIN)
        if (!target.startsWith('/') || url.origin !== ORIGIN) return null
        // The router decodes the path again, so `/%2Fevil.com` must not become //evil.com there.
        const path = decodeURIComponent(url.pathname)
        if (/^\/[\\/]/.test(path) || /^\/go(\/|$)/i.test(path)) return null
        const out = url.pathname + url.search + url.hash
        // What the browser parses from the Location header must still be peanut.me.
        return new URL(out, ORIGIN).origin === ORIGIN ? out : null
    } catch {
        return null
    }
}
