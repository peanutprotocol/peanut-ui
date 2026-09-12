'use client'

/**
 * Deposit accounts — bank details the user holds and hands to whoever pays
 * them.
 *
 * The backend returns `matching` and `instructions` and nothing about the
 * provider, so every screen renders each corridor from the same four policy
 * fields. See `src/features/deposit-accounts/types.ts` for why those four
 * decide what the app is allowed to say.
 */

import { apiErrorFromResponse } from '@/services/api-error'
import { apiFetch } from '@/utils/api-fetch'
import type { DepositAccount } from '@/features/deposit-accounts/types'

export async function fetchDepositAccounts(): Promise<DepositAccount[]> {
    const response = await apiFetch('/users/deposit-accounts', { method: 'GET' })
    if (!response.ok) throw await apiErrorFromResponse(response, 'Could not load your deposit accounts')
    const body = (await response.json()) as { depositAccounts: DepositAccount[] }
    return body.depositAccounts
}

/**
 * Claim the account for one corridor. Idempotent backend-side: claiming twice
 * returns the same account rather than opening a second one, so a double tap
 * is harmless.
 */
export async function claimDepositAccount(method: string): Promise<DepositAccount> {
    const response = await apiFetch('/users/deposit-accounts', {
        method: 'POST',
        body: JSON.stringify({ method }),
    })
    if (!response.ok) throw await apiErrorFromResponse(response, 'Could not open the account')
    const body = (await response.json()) as { depositAccount: DepositAccount }
    return body.depositAccount
}
