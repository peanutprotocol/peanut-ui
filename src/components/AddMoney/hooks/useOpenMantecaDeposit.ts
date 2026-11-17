'use client'

import { mantecaApi } from '@/services/manteca'
import { useQuery } from '@tanstack/react-query'

/**
 * The user's newest unpaid Manteca deposit order in `currency`, or null.
 * A new order makes Manteca cancel the open one, so the amount step offers
 * this order back before the user creates another.
 */
export function useOpenMantecaDeposit(currency: string | undefined, enabled: boolean) {
    const { data, isFetching } = useQuery({
        queryKey: ['manteca-open-deposit', currency],
        queryFn: () => mantecaApi.getOpenDeposit(currency!),
        enabled: enabled && !!currency,
        gcTime: 0,
    })
    // a cached order may have expired or been replaced since; only a settled lookup counts
    if (!enabled || isFetching) return null
    return data?.data ?? null
}
