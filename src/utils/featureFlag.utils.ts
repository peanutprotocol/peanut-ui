import posthog from 'posthog-js'
import { BASE_URL } from '@/constants/general.consts'

/**
 * PostHog feature flags — the runtime-toggle primitive (non-reactive reads;
 * components use the `useFeatureFlags` hook so they
 * re-render when flags load).
 *
 * DOCTRINE (mono engineering/patterns/feature-gates.md): a PostHog flag
 * answers "have we LAUNCHED this?" — flipped in the PostHog UI, no deploy,
 * cohort/% targeting. It is NOT a kill-switch: incident switches come from
 * our API (`/config/kill-switches`, read through
 * `features/kill-switches/kill-switches-store.ts`), not PostHog and not code.
 * Flags are scaffolding — delete them once a launch is permanent.
 */
const IS_PROD_DOMAIN = BASE_URL === 'https://peanut.me'

/**
 * Every PostHog flag the app reads, with the value it takes when PostHog has
 * not answered: a first visit with no cache, after logout (`reset()`), a
 * timeout, blocked storage or an ad blocker. A missing flag is not "off"; it
 * is this value. Pick the value that is safe if PostHog stays down: money,
 * access and compliance take the conservative state. If the safe value is
 * "on", the toggle is not a rollout gate: make it code or a kill switch.
 *
 * The `autocapture-sample-rate` payload flag is read separately; its default
 * (keep every event) lives in `posthog-autocapture.ts`.
 */
export const FLAG_DEFAULTS = {
    // Card marketing stays visible: the flag only mutes promotion, and /card works either way.
    'card-promotion-disabled': false,
    // The homepage card fold stays visible: the flag only mutes promotion.
    'landing-card-fold-disabled': false,
    // KYC stays available: an unanswered PostHog must not tell every user verification is down.
    'kyc-verification-down': false,
    // Add-to-wallet is a card rollout gate: hidden until PostHog answers "on". The API gates it too.
    'push-provisioning-apple': false,
    'push-provisioning-google': false,
    // Session-key spend signing moves money: off unless PostHog, the build and the API all agree.
    session_key_spend_sign: false,
    // The interview invite is optional marketing: hidden when PostHog is silent.
    'user-interviews-invite': false,
} as const satisfies Record<string, boolean>

export type FeatureFlagKey = keyof typeof FLAG_DEFAULTS

export interface FeatureFlagOptions {
    /** Treat the flag as ON outside the prod domain (rollout-gate semantics:
     *  staging/preview/local always see the feature so QA can test
     *  pre-launch; prod uses the registered default when PostHog is unavailable). */
    nonProdBypass?: boolean
}

export function isFeatureFlagEnabled(flagKey: FeatureFlagKey, options: FeatureFlagOptions = {}): boolean {
    if (options.nonProdBypass && !IS_PROD_DOMAIN) return true
    return posthog.isFeatureEnabled(flagKey, { defaultValue: FLAG_DEFAULTS[flagKey] })
}

/** PostHog distinguishes an evaluated false from the pre-fetch unknown state. */
export function areFeatureFlagsLoaded(): boolean {
    return posthog.featureFlags.hasLoadedFlags
}
