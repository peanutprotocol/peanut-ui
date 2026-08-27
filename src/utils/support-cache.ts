/**
 * Cache-only reads for the Crisp support snapshot.
 *
 * Two rules, and both are load-bearing.
 *
 * **Never subscribe.** `useCrispUserData` is mounted app-wide (SupportDrawer
 * sits in the layout, for guests too), so calling `useWallet()` there would
 * switch on a 30s RPC poll for every logged-in user on every screen, and
 * `useRainCardOverview()` would add a request per session. These readers take
 * whatever is already in the react-query cache and return `undefined` when it
 * isn't there. A missing value is reported as unavailable, never as a zero.
 *
 * **Only read a key that names its owner.** Both keys here carry the identity
 * they belong to — the balance by wallet address, the card overview by user id
 * — so a cached entry can be proved to belong to the person support is open
 * for. `[limits]` and `[transactions]` cannot: their keys are account-agnostic,
 * so after a passive session expiry they stay warm and a different account
 * would read them as its own. Limits and latest activity are therefore absent
 * from the snapshot until those keys are user-scoped. Do NOT add a reader here
 * that cannot answer "whose data is this?" from the key alone.
 */

import type { QueryClient } from '@tanstack/react-query'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { smartUsdcBalanceQueryOptions } from '@/hooks/wallet/useBalance'
import type { RainCardOverview } from '@/services/rain'
import type { Address } from 'viem'

export function readCachedSmartBalance(client: QueryClient, address: string | undefined): bigint | undefined {
    if (!address) return undefined
    return client.getQueryData<bigint>(smartUsdcBalanceQueryOptions(address as Address).queryKey)
}

export function readCachedRainOverview(client: QueryClient, userId: string | undefined): RainCardOverview | undefined {
    if (!userId) return undefined
    return client.getQueryData<RainCardOverview>([RAIN_CARD_OVERVIEW_QUERY_KEY, userId])
}
