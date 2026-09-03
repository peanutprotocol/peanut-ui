import { isFeatureFlagEnabled } from '@/utils/featureFlag.utils'

/*
 * Per-transaction ephemeral session key for the mixed spend path
 * (src/utils/ephemeralSpendKey.ts) — collapses the two passkey prompts
 * (Rain admin EIP-712 + UserOp) into one enable-signature tap.
 *
 * Two gates (the HARNESS_ENABLED pattern):
 *   1. Build-time: NEXT_PUBLIC_SESSION_KEY_SPEND is inlined by Next.js, so in
 *      builds without it every branch is dead code the bundler drops. The
 *      native release lanes bake it in; the web build leaves it out.
 *   2. Runtime: the PostHog flag below (cohort / % rollout, flipped without a
 *      release), OR the per-device localStorage opt-in from
 *      /dev/session-key-spend for builds where the dev routes are reachable.
 *
 * The ephemeral key signs the Rain admin EIP-712 via ERC-1271, whose validity
 * depends on the permission being installed in the same UserOp's validation
 * phase — proven on a fork, still to be confirmed by a flagged spend against
 * production contracts before the flag is widened past internal users.
 */
export const SESSION_KEY_SPEND_BUILD_ENABLED = process.env.NEXT_PUBLIC_SESSION_KEY_SPEND === 'true'

export const SESSION_KEY_SPEND_FLAG = 'session_key_spend'

const DEVICE_OPT_IN_KEY = '__session_key_spend'

export function sessionKeySpendDeviceOptIn(): boolean {
    try {
        return typeof window !== 'undefined' && window.localStorage?.getItem(DEVICE_OPT_IN_KEY) === 'true'
    } catch {
        return false
    }
}

export function setSessionKeySpendDeviceOptIn(on: boolean): void {
    if (on) window.localStorage.setItem(DEVICE_OPT_IN_KEY, 'true')
    else window.localStorage.removeItem(DEVICE_OPT_IN_KEY)
}

export function sessionKeySpendEnabled(): boolean {
    if (!SESSION_KEY_SPEND_BUILD_ENABLED) return false
    return sessionKeySpendDeviceOptIn() || isFeatureFlagEnabled(SESSION_KEY_SPEND_FLAG)
}
