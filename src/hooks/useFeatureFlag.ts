'use client'
import { useEffect, useReducer } from 'react'
import posthog from 'posthog-js'
import { BASE_URL } from '@/constants/general.consts'

/**
 * PostHog feature flags — the runtime-toggle primitive.
 *
 * DOCTRINE (see engineering/patterns/feature-gates.md in mono): a PostHog
 * flag answers "have we LAUNCHED this?" — flipped in the PostHog UI with no
 * deploy, supports cohort/% targeting. It is NOT a kill-switch: incident
 * switches stay in code (`underMaintenance.config.ts`) because the emergency
 * brake must not depend on a third-party SaaS. Flags are scaffolding —
 * delete them once a launch is permanent.
 *
 * Failure semantics are per-feature via options:
 * - rollout gates want `nonProdBypass` (staging/preview/local always ON so
 *   QA can test pre-launch) and fail CLOSED on prod when PostHog is
 *   unavailable — a rollout gate must never fail into "launched".
 */
const IS_PROD_DOMAIN = BASE_URL === 'https://peanut.me'

export interface FeatureFlagOptions {
    /** Treat the flag as ON outside the prod domain (rollout-gate semantics). */
    nonProdBypass?: boolean
}

export function isFeatureFlagEnabled(flagKey: string, options: FeatureFlagOptions = {}): boolean {
    if (options.nonProdBypass && !IS_PROD_DOMAIN) return true
    return posthog.isFeatureEnabled(flagKey) ?? false
}

/**
 * Reactive read of PostHog feature flags: re-renders once flags load (they
 * arrive async after page load) so gated UI pops in without a refresh.
 * Returns a checker so one subscription serves any number of flags.
 */
export function useFeatureFlags(): (flagKey: string, options?: FeatureFlagOptions) => boolean {
    const [, bump] = useReducer((n: number) => n + 1, 0)
    useEffect(() => {
        // returns an unsubscribe function
        return posthog.onFeatureFlags(() => bump())
    }, [])
    return isFeatureFlagEnabled
}
