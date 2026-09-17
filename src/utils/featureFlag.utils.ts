import posthog from 'posthog-js'
import { BASE_URL } from '@/constants/general.consts'

/**
 * PostHog feature flags — the runtime-toggle primitive (non-reactive reads;
 * components use the `useFeatureFlags` hook so they
 * re-render when flags load).
 *
 * DOCTRINE (mono engineering/patterns/feature-gates.md): a PostHog flag
 * answers "have we LAUNCHED this?" — flipped in the PostHog UI, no deploy,
 * cohort/% targeting. It is NOT a kill-switch: incident switches stay in
 * code (`underMaintenance.config.ts`). Flags are scaffolding — delete them
 * once a launch is permanent.
 */
const IS_PROD_DOMAIN = BASE_URL === 'https://peanut.me'

export interface FeatureFlagOptions {
    /** Treat the flag as ON outside the prod domain (rollout-gate semantics:
     *  staging/preview/local always see the feature so QA can test
     *  pre-launch; prod fails CLOSED when PostHog is unavailable). */
    nonProdBypass?: boolean
}

export function isFeatureFlagEnabled(flagKey: string, options: FeatureFlagOptions = {}): boolean {
    if (options.nonProdBypass && !IS_PROD_DOMAIN) return true
    return posthog.isFeatureEnabled(flagKey) ?? false
}

/** PostHog distinguishes an evaluated false from the pre-fetch unknown state. */
export function areFeatureFlagsLoaded(): boolean {
    return posthog.featureFlags.hasLoadedFlags
}
