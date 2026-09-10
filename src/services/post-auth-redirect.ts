import { clearRedirectUrl, getRedirectOrigin, getRedirectUrl, getValidRedirectUrl } from '@/utils/general.utils'

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
    /**
     * Take a stored destination ONLY where it is classified as the intent of
     * the person authenticating. Set by a brand-new account, which inherits no
     * other session's page however that page came to be stored — this device's
     * own logout, a revoked session in another tab, a token that expired while
     * the app stood open.
     *
     * A whitelist rather than a session-end blacklist, because that is also
     * the rollout policy for records written before the origin existed: the
     * deployed version stored a bare path, and the reported bug IS such a
     * record (a logout on /profile). Unclassified ones are discarded here, so
     * an existing stale record cannot reproduce it on the first deploy; login
     * keeps honouring them, and an explicit `redirect_uri` outranks this
     * entirely, which is what campaign and claim entry points use.
     */
    onlyClassifiedIntent?: boolean
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
        // Consumed, not merely skipped: leaving it would hand the same page to
        // whoever authenticates next on this device.
        if (options.onlyClassifiedIntent && getRedirectOrigin() !== 'deep-link') {
            clearRedirectUrl()
            return { destination: fallbackRoute, source: 'fallback', deferred: false }
        }

        const destination = getValidRedirectUrl(storedValue, fallbackRoute)
        if (destination !== fallbackRoute && options.deferStoredRedirect?.(destination)) {
            return { destination: fallbackRoute, source: 'stored', deferred: true }
        }

        clearRedirectUrl()
        return { destination, source: 'stored', deferred: false }
    }

    /*
     * Corrupt or blank generic state is no more reusable than an unsafe URL.
     * Unconditional now that a reader reports an unusable record as no record
     * at all: the raw value can still be sitting there, and clearing a key
     * that does not exist costs nothing.
     */
    clearRedirectUrl()
    return { destination: fallbackRoute, source: 'fallback', deferred: false }
}
