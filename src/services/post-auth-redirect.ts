import { clearRedirectUrl, getRedirectUrl, getValidRedirectUrl } from '@/utils/general.utils'

export type PostAuthRedirectDecision = {
    destination: string
    source: 'explicit' | 'stored' | 'fallback'
    deferred: boolean
}

type PostAuthRedirectOptions = {
    fallbackRoute?: string
    /**
     * Keep a safe stored intent for a later post-signup action (for example,
     * showing the bank-claim continuation after identity verification).
     */
    deferStoredRedirect?: (destination: string) => boolean
}

/**
 * Select and consume post-auth navigation in one place.
 *
 * An explicit `redirect_uri` always outranks generic stored state. Selecting
 * it also discards that lower-priority state, including when the explicit URL
 * is malformed and resolves to the safe fallback; otherwise an acquisition
 * destination can unexpectedly resurrect during a later login.
 *
 * Stored state is one-shot by default. A caller may deliberately defer a safe
 * stored destination for a later post-signup action, in which case it remains
 * available and this function routes to the fallback for now.
 */
export function consumePostAuthRedirect(
    explicitRedirectUri: string | null,
    options: PostAuthRedirectOptions = {}
): PostAuthRedirectDecision {
    const fallbackRoute = options.fallbackRoute ?? '/home'

    if (explicitRedirectUri !== null) {
        clearRedirectUrl()
        return {
            destination: getValidRedirectUrl(explicitRedirectUri, fallbackRoute),
            source: 'explicit',
            deferred: false,
        }
    }

    const storedValue = getRedirectUrl()
    if (typeof storedValue === 'string' && storedValue.length > 0) {
        const destination = getValidRedirectUrl(storedValue, fallbackRoute)
        if (destination !== fallbackRoute && options.deferStoredRedirect?.(destination)) {
            return { destination: fallbackRoute, source: 'stored', deferred: true }
        }

        clearRedirectUrl()
        return { destination, source: 'stored', deferred: false }
    }

    // Corrupt or blank generic state is no more reusable than an unsafe URL.
    if (storedValue !== null && storedValue !== undefined) clearRedirectUrl()
    return { destination: fallbackRoute, source: 'fallback', deferred: false }
}
