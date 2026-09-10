'use client'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'

/**
 * Ops kill-switch for identity verification: when the Sumsub SDK is down
 * (launch-timeout spike, provider outage), flip the `kyc-verification-down`
 * PostHog flag and every KYC entry point replaces its CTA with an honest
 * "temporarily down, we'll notify you" message instead of letting users retry
 * into a broken SDK (the invisible July outage this is built for — see the
 * KYC_SDK_LAUNCH_* analytics events).
 *
 * Fails closed (false) until flags load, so the happy path never flickers.
 */
export const KYC_DEGRADED_FLAG = 'kyc-verification-down'

export function useKycDegraded(): boolean {
    const isEnabled = useFeatureFlags()
    return isEnabled(KYC_DEGRADED_FLAG)
}
