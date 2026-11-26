import { isCancelledError, type QueryClient } from '@tanstack/react-query'
import { formatUnits, type Address } from 'viem'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { peekActiveFixture } from '@/dev/fixtures/active'
import { fetchLiveSmartUsdcBalance } from '@/hooks/wallet/spendPreflight'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { rainApi } from '@/services/rain'
import { computeAvailableSpendable, isRainBalanceKnown } from '@/utils/balance.utils'
import { isDemoMode } from '@/utils/demo'
import { getDemoBalanceUnits } from '@/utils/demo-balance'

/**
 * The spendable balance in dollars, read fresh now: the smart account on-chain and the Rain collateral
 * from a new card overview (the same sum `useWallet` shows). Both reads write their queries, so the
 * step's own balance moves with them. Rejects when either read fails or the collateral is unknown: a
 * money decision never runs on a cached or partial balance. Demo mode and fixtures read the demo
 * balance, as `useWallet` does.
 */
export async function readLiveSpendableUsd(
    queryClient: QueryClient,
    { address, userId }: { address: Address | undefined; userId: string | undefined }
): Promise<number> {
    // another refresh of the same query cancels this one; one more read is still fresh
    const fresh = async <T>(read: () => Promise<T>): Promise<T> => {
        try {
            return await read()
        } catch (error) {
            if (isCancelledError(error)) return read()
            throw error
        }
    }
    const demo = isDemoMode() || !!peekActiveFixture()
    if (!demo && !address) throw new Error('wallet address unknown')
    const [smart, overview] = await Promise.all([
        demo ? Promise.resolve(getDemoBalanceUnits()) : fresh(() => fetchLiveSmartUsdcBalance(queryClient, address!)),
        fresh(() =>
            queryClient.fetchQuery({
                queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY, userId],
                queryFn: () => rainApi.getOverview(),
                staleTime: 0,
                retry: 1,
            })
        ),
    ])
    // a cached collateral figure kept for display is not a live read
    if (!isRainBalanceKnown(overview) || overview?.balanceUnavailable) throw new Error('card collateral not live')
    return Number(
        formatUnits(computeAvailableSpendable(smart, overview?.balance?.spendingPower), PEANUT_WALLET_TOKEN_DECIMALS)
    )
}
