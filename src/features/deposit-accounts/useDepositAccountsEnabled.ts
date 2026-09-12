'use client'

import { peekActiveFixture } from '@/dev/fixtures/active'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'

/**
 * Has get-paid launched?
 *
 * Bridge's Virtual Accounts SKU is `not_allowed` in production, so every claim
 * a production user makes today fails at the provider. The flow is therefore
 * dark until the SKU is granted and the flag is flipped in PostHog: the Add
 * drawer's bank row goes back to the one-off transfer flow, /request does not
 * offer the link, and /get-paid sends anyone who reaches it to the flow that
 * does work.
 *
 * Default OFF everywhere, including previews and staging. Fails closed while
 * flags load, because the failure this guards is a user handing an employer
 * bank details that the provider will not honour.
 *
 * Fixtures are the one exception: they answer every API call from a named app
 * state and never reach a provider, so the design harness and the screenshot
 * run keep rendering the feature while it is off for real users.
 */
export const DEPOSIT_ACCOUNTS_FLAG = 'deposit-accounts'

export function useDepositAccountsEnabled(): boolean {
    const isEnabled = useFeatureFlags()
    if (peekActiveFixture() !== null) return true
    return isEnabled(DEPOSIT_ACCOUNTS_FLAG)
}
