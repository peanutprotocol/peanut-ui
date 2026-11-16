import { isSameRoute } from '@/constants/routes'
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
        // isSameRoute owns the one trailing-slash rule for the whole app
        if (isSameRoute(currentPathname, targetPathname)) return null
    }

    return sanitized
}

/**
 * Where a finished flow leaves to: `returnTo`, unless it names one of `hubs`, a
 * picker that sent itself so Back reopens it. A hub is never the target; its own
 * `returnTo` is followed instead, so a flow that sent the user to the hub still
 * gets them back. Null when no origin past the hubs is stated.
 */
export const originPastHubs = (returnTo: string | null, hubs: readonly string[]): string | null => {
    let target = returnTo
    // each hub wraps the one before it once (picker → chooser → flow); more is a loop
    for (let depth = 0; target && depth <= hubs.length; depth++) {
        const [path, query = ''] = target.split('#')[0].split('?')
        if (!hubs.some((hub) => isSameRoute(path, hub))) return target
        target = readReturnTo(new URLSearchParams(query), path)
    }
    return null
}
