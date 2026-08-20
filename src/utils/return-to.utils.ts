import { sanitizeRedirectURL } from './general.utils'

/**
 * `?returnTo=` — the origin a flow root should send the user back to.
 *
 * The add-money and withdraw roots are entry points: their back buttons reset to
 * `/home` rather than calling `router.back()`, because their own sub-pages push
 * back to the root and `back()` there ping-pongs. That's correct when the flow
 * was entered from the tab bar, but it strands anyone who arrived from another
 * screen — e.g. the exchange-rate widget's "Try it!" CTA, after which back used
 * to drop the user on /home instead of the widget they came from.
 *
 * So the *caller* states where back should go, and the flow root honours it.
 * Same-origin only, and never the page the user is already on (a self-referential
 * value would make back a no-op — the very bug this fixes).
 */
export const RETURN_TO_PARAM = 'returnTo'

/** Appends `?returnTo=<path>` to `route`, preserving any query string it already has. */
export const withReturnTo = (route: string, returnTo: string): string => {
    const sanitized = sanitizeRedirectURL(returnTo)
    if (!sanitized) return route
    const separator = route.includes('?') ? '&' : '?'
    return `${route}${separator}${RETURN_TO_PARAM}=${encodeURIComponent(sanitized)}`
}

type ReadonlyParams = Pick<URLSearchParams, 'get'> | null | undefined

/**
 * Reads a safe `returnTo` target out of the current query string.
 * Returns null when absent, off-origin, or pointing at `currentPathname`.
 */
export const readReturnTo = (searchParams: ReadonlyParams, currentPathname?: string | null): string | null => {
    const raw = searchParams?.get(RETURN_TO_PARAM)
    if (!raw) return null

    const sanitized = sanitizeRedirectURL(raw)
    if (!sanitized) return null

    if (currentPathname) {
        const targetPathname = sanitized.split(/[?#]/)[0]
        // trailing slash is not a meaningful difference for Next.js routes
        const normalize = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path)
        if (normalize(targetPathname) === normalize(currentPathname)) return null
    }

    return sanitized
}
