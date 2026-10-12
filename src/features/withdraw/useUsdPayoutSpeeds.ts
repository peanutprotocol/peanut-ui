'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getExternalAccountPaymentRails, getUsdPayoutRailFees } from '@/app/actions/offramp'
import { usdPayoutSpeedOptions, type UsdPayoutSpeedOption } from './usd-payout-speed'

/**
 * The speeds a USD withdrawal to this account can take, with their fees
 * (TASK-23054). Reads the backend's fee table and the provider's answer on
 * which rails the account takes. Both reads are optional: a failed one leaves
 * same-day ACH alone (no fee table) or lets the provider decide at transfer
 * time (no rail answer).
 *
 * `isReady` holds the withdrawal until the speeds on screen are final.
 */
export function useUsdPayoutSpeeds({
    enabled,
    customerId,
    externalAccountId,
    amountUsd,
}: {
    enabled: boolean
    customerId: string | null | undefined
    externalAccountId: string | null | undefined
    amountUsd: number
}): { options: UsdPayoutSpeedOption[]; isReady: boolean } {
    const fees = useQuery({
        queryKey: ['usdPayoutRailFees'],
        queryFn: async () => {
            const { data, error } = await getUsdPayoutRailFees()
            if (!data) throw new Error(error ?? 'No payout fees')
            return data
        },
        enabled,
        // the table changes with a deploy, not while a screen is open
        staleTime: 5 * 60 * 1000,
        retry: 1,
    })
    const accountRails = useQuery({
        queryKey: ['externalAccountPaymentRails', customerId, externalAccountId],
        queryFn: async () => {
            const { data, error } = await getExternalAccountPaymentRails(customerId!, externalAccountId!)
            if (error) throw new Error(error)
            return data ?? null
        },
        enabled: enabled && !!customerId && !!externalAccountId,
        staleTime: 5 * 60 * 1000,
        retry: 1,
    })

    const options = useMemo(
        () =>
            enabled
                ? usdPayoutSpeedOptions({
                      fees: fees.data,
                      amountUsd,
                      supportedRails: accountRails.data?.supported,
                  })
                : [],
        [enabled, fees.data, amountUsd, accountRails.data]
    )
    return { options, isReady: !enabled || (!fees.isLoading && !accountRails.isLoading) }
}
