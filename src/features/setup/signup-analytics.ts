import { type ScreenId } from '@/components/Setup/Setup.types'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
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
        if (path === '/profile/identity-verification' || path.startsWith('/profile/identity-verification/')) {
            return 'identity-verification'
        }
        if (path === '/card' || path.startsWith('/card/')) return 'card'
        if (path === '/claim' || path.startsWith('/claim/')) return 'claim'
        return 'other'
    } catch {
        return 'other'
    }
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
