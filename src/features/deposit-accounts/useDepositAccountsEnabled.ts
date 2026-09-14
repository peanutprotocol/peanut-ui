'use client'

import { useFeatureFlags } from '@/hooks/useFeatureFlag'

/**
 * Has get-paid launched?
 *
 * Bridge's Virtual Accounts SKU is `not_allowed` in production, so every claim
 * a production user makes today fails at the provider. The flow is therefore
 * dark in production until the SKU is granted and the flag is flipped in
 * PostHog: the Add drawer's bank row goes back to the one-off transfer flow,
 * /request does not offer the link, and /get-paid sends anyone who reaches it
 * to the flow that does work.
 *
 * `nonProdBypass` is the standard rollout-gate behaviour every other flag here
 * uses: local, previews, staging and the Nutcracker sandbox always see the
 * feature so it can be tested, and production fails closed while flags load.
 * The dev fixtures are covered by the same bypass — fixture mode only exists
 * in development and preview builds, which are never the production domain.
 */
export const DEPOSIT_ACCOUNTS_FLAG = 'deposit-accounts'

export function useDepositAccountsEnabled(): boolean {
    const isEnabled = useFeatureFlags()
    return isEnabled(DEPOSIT_ACCOUNTS_FLAG, { nonProdBypass: true })
}
