'use client'

/**
 * Deposit accounts — bank details the user holds and hands to whoever pays
 * them.
 *
 * The backend returns `matching` and `instructions` and nothing about the
 * provider, so every screen renders each corridor from the same two policy
 * fields. See `src/features/deposit-accounts/types.ts` for why those two
 * decide what the app is allowed to say.
 */

import { apiErrorFromResponse } from '@/services/api-error'
import { apiFetch } from '@/utils/api-fetch'
import type { ClaimableCorridor, DepositAccount } from '@/features/deposit-accounts/types'
import type { paths } from '@/types/api.generated'

type DepositAccountsResponse = paths['/users/deposit-accounts']['get']['responses'][200]['content']['application/json']
type ClaimResponse = paths['/users/deposit-accounts']['post']['responses'][200]['content']['application/json']

/**
 * One read answers both questions the flow asks: what the user already holds,
 * and what the corridors they do not hold would promise a payer. The second
 * comes from the same resolver as the first, so the claim step states the
 * terms rather than promising them later.
 */
export interface DepositAccountsSnapshot {
    accounts: DepositAccount[]
    claimable: ClaimableCorridor[]
    /** this user's own account limit, which support can raise; absent on an API that predates it */
    accountLimit?: number
    /** the accounts the cap counts, as the backend counts them; absent on an API that predates it */
    accountsHeld?: number
}

/**
 * Two fields of api#1638 the committed OpenAPI snapshot does not carry yet.
 * Read as optional numbers, so an API without them changes nothing.
 */
type AccountCapFields = { accountLimit?: unknown; accountsHeld?: unknown }

const countOrUndefined = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined

export async function fetchDepositAccounts(): Promise<DepositAccountsSnapshot> {
    const response = await apiFetch('/users/deposit-accounts', { method: 'GET' })
    if (!response.ok) throw await apiErrorFromResponse(response, 'Could not load your deposit accounts')
    const body = (await response.json()) as DepositAccountsResponse & AccountCapFields
    // An API that predates the preview sends no `claimable` at all. The claim
    // step then states no terms, which is what it did before this field
    // existed — never a row of defaults the screen would read as promises.
    return {
        accounts: body.depositAccounts,
        claimable: body.claimable ?? [],
        accountLimit: countOrUndefined(body.accountLimit),
        accountsHeld: countOrUndefined(body.accountsHeld),
    }
}

/**
 * What a claim came back with.
 *
 * Opening the account is one of three answers. Two corridors need a review at
 * the provider that the tap itself asks for, and the answer is then a wait, or
 * a list of things the user has to supply — never an account.
 */
export type DepositClaimResult = ClaimResponse

/**
 * Claim the account for one corridor. Idempotent backend-side: claiming twice
 * returns the same account rather than opening a second one, and a corridor
 * whose review is already under way is not asked for again, so a double tap is
 * harmless either way.
 */
export async function claimDepositAccount(method: string): Promise<DepositClaimResult> {
    const response = await apiFetch('/users/deposit-accounts', {
        method: 'POST',
        body: JSON.stringify({ method }),
    })
    if (!response.ok) throw await apiErrorFromResponse(response, 'Could not open the account')
    return (await response.json()) as ClaimResponse
}
