'use client'
import { useKillSwitches } from '@/features/kill-switches/useKillSwitches'

/**
 * Ops kill-switch for identity verification: when the Sumsub SDK is down
 * (launch-timeout spike, provider outage), flip the `kill_switch.kycVerificationDown`
 * row and every KYC entry point replaces its CTA with an honest
 * "temporarily down, we'll notify you" message instead of letting users retry
 * into a broken SDK (the invisible July outage this is built for — see the
 * KYC_SDK_LAUNCH_* analytics events).
 *
 * Off until the API says otherwise, so the happy path never flickers.
 */
export function useKycDegraded(): boolean {
    return useKillSwitches().kycVerificationDown
}
