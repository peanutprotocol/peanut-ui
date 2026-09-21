import { type ScreenId } from '@/components/Setup/Setup.types'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { type StoredRedirect } from '@/utils/general.utils'
import posthog from 'posthog-js'

export const SIGNUP_FLOW_VERSION = 1

export type SignupEntryFlow = 'default' | 'add-money' | 'identity-verification' | 'card' | 'claim' | 'other'
export type SignupAnalyticsScreenId = ScreenId | 'account-ready'
export type SignupNavigationType = 'initial' | 'forward' | 'back' | 'jump'

const PEANUT_ORIGIN = 'https://peanut.me'

/**
 * Converts redirect_uri into a low-cardinality acquisition branch. Keeping the
 * raw destination out of custom properties avoids IDs/query values fragmenting
 * dashboards while still preserving the signup intent needed by funnels.
 */
export function classifySignupEntryFlow(redirectUri: string | null): SignupEntryFlow {
    if (!redirectUri?.trim()) return 'default'

    let decoded = redirectUri.trim()
    try {
        decoded = decodeURIComponent(decoded)
    } catch {
        // URLSearchParams already decodes normal values. A malformed escape is
        // simply an unclassified destination, not a reason to break analytics.
    }

    try {
        const destination = new URL(decoded, PEANUT_ORIGIN)
        if (destination.origin !== PEANUT_ORIGIN) return 'other'

        const path = destination.pathname.replace(/\/+$/, '') || '/'
        if (path === '/' || path === '/home') return 'default'
        if (path === '/add-money' || path.startsWith('/add-money/')) return 'add-money'
        // Matches both the current path and the pre-2026-09-19 URL (redirect_uri
        // values from old links/bookmarks still arrive with the old segment) —
        // both bucket into the same stable analytics label.
        if (
            path === '/profile/accounts-and-payments' ||
            path.startsWith('/profile/accounts-and-payments/') ||
            path === '/profile/identity-verification' ||
            path.startsWith('/profile/identity-verification/')
        ) {
            return 'identity-verification'
        }
        if (path === '/card' || path.startsWith('/card/')) return 'card'
        if (path === '/claim' || path.startsWith('/claim/')) return 'claim'
        return 'other'
    } catch {
        return 'other'
    }
}

/**
 * Resolves the immutable signup-entry category without consuming the post-auth
 * destination. An explicit redirect always wins. A stored session-end record
 * belongs to the previous account, while a legacy unclassified record remains
 * eligible during the redirect-v2 rollout for the same reason the post-auth
 * consumer still honours it.
 */
export function resolveSignupEntryFlow(
    explicitRedirectUri: string | null,
    storedRedirect: Pick<StoredRedirect, 'destination' | 'origin'> | null
): SignupEntryFlow {
    if (explicitRedirectUri !== null) return classifySignupEntryFlow(explicitRedirectUri)
    if (storedRedirect?.origin === 'session-end') return 'default'
    return classifySignupEntryFlow(storedRedirect?.destination ?? null)
}

export function signupAnalyticsContext(signupEntryFlow: SignupEntryFlow) {
    return {
        flow_version: SIGNUP_FLOW_VERSION,
        signup_entry_flow: signupEntryFlow,
    }
}

export function captureSignupStepViewed({
    screenId,
    stepIndex,
    totalSteps,
    navType,
    signupEntryFlow,
}: {
    screenId: SignupAnalyticsScreenId
    /** One-based index in the semantic signup flow. */
    stepIndex: number
    totalSteps: number
    navType: SignupNavigationType
    signupEntryFlow: SignupEntryFlow
}) {
    posthog.capture(ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED, {
        screen_id: screenId,
        step_index: stepIndex,
        total_steps: totalSteps,
        nav_type: navType,
        ...signupAnalyticsContext(signupEntryFlow),
    })
}
