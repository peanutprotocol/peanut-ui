'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/authContext'
import { useZeroDev } from '@/hooks/useZeroDev'
import { rainApi, type RainFundingAccess } from '@/services/rain'
import { fundingSetupPath, type CardFlowIdentity } from '@/utils/rain-funding.utils'

export const RAIN_CARD_FUNDING_ACCESS_QUERY_KEY = 'rain-card-funding-access'

/**
 * The cache key of the funding decision. The decision is for one user's
 * current wallet, so the key carries both: another account, or another
 * wallet of the same account, never reads a cached answer that was not its own.
 * Every read, write and invalidation of the decision goes through this key.
 */
export const fundingAccessQueryKey = ({ userId, connectedAddress }: CardFlowIdentity) => [
    RAIN_CARD_FUNDING_ACCESS_QUERY_KEY,
    userId,
    connectedAddress?.toLowerCase(),
]

/**
 * The server's card funding decision for the signed-in account and wallet
 * (`GET /rain/cards/funding/access`). Display only: every step that signs,
 * enrolls or grants reads the decision again right before it acts.
 *
 * A failed read is unknown, never legacy: `setupPath` is then undefined and
 * nothing is offered.
 */
export const useCardFundingAccess = ({ enabled = true }: { enabled?: boolean } = {}) => {
    const { user } = useAuth()
    const userId = user?.user?.userId
    const { address: connectedAddress } = useZeroDev()
    const query = useQuery<RainFundingAccess>({
        queryKey: fundingAccessQueryKey({ userId, connectedAddress }),
        queryFn: () => rainApi.getFundingAccess(),
        enabled: enabled && !!userId,
        staleTime: 30_000,
        retry: false,
    })
    const access = query.isError ? undefined : query.data
    return {
        access,
        /** `managed` | `legacy` | undefined (unknown: offer nothing). */
        setupPath: fundingSetupPath(access),
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    }
}
