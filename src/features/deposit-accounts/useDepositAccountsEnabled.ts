'use client'

import { useAuth } from '@/context/authContext'

/**
 * Have standing deposit accounts launched for this user?
 *
 * The one rollout gate is the `app.configurations` row the claim route reads
 * (`deposit_accounts.enabled`, or the `deposit_accounts.allowed_user_ids`
 * cohort). `/users/me` reports that decision as `depositAccounts.enabled`, so
 * the app shows the feature exactly where a claim would succeed and a rollback
 * is a row flip, not a deploy. Off = the app as it was before deposit
 * accounts: the Add drawer's bank row goes to the one-off transfer flow,
 * /request offers no link, and the bank hub shows the country list alone.
 *
 * Fails closed: no user, or an API that predates the field, reads as off.
 */
export function useDepositAccountsEnabled(): boolean {
    const { user } = useAuth()
    return user?.depositAccounts?.enabled === true
}
