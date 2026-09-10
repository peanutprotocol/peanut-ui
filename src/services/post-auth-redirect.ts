import { clearRedirectUrl, getStoredRedirect, getValidRedirectUrl } from '@/utils/general.utils'

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
     * Refuse a destination that only records where an earlier session ended.
     * Set by a brand-new account: it inherits no other session's page, however
     * that page came to be stored (this device's own logout, a revoked session
     * in another tab, a token that expired while the app stood open).
     *
     * Rollout: a record written before the origin existed is a bare path, and
     * it is honoured. Discarding those instead would have dropped the stored
     * pay-link continuation for anyone mid-funnel across the deploy — a
     * signup entered from /receipt or a request link landing on /home, which
     * SendWithPeanutCta and the account-ready CTA exist to prevent. The
     * transitional cost of honouring them is the reverse case, a new account
     * on the previous session's page, which the Back fix in this PR already
     * makes harmless; and the window closes at the first write after deploy,
     * because every writer classifies from then on.
     */
    rejectSessionEndOrigin?: boolean
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

    /*
     * One snapshot, one decision. Reading the destination and the origin
     * separately is two getItems, and another tab can replace the record
     * between them — pairing an old destination with the newer record's
     * origin, then consuming the newer intent along with it.
     */
    const stored = getStoredRedirect()
    if (stored) {
        // Consumed, not merely skipped: leaving it would hand the same page to
        // whoever authenticates next on this device.
        if (options.rejectSessionEndOrigin && stored.origin === 'session-end') {
            clearRedirectUrl(stored)
            return { destination: fallbackRoute, source: 'fallback', deferred: false }
        }

        const destination = getValidRedirectUrl(stored.destination, fallbackRoute)
        if (destination !== fallbackRoute && options.deferStoredRedirect?.(destination)) {
            return { destination: fallbackRoute, source: 'stored', deferred: true }
        }

        clearRedirectUrl(stored)
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
