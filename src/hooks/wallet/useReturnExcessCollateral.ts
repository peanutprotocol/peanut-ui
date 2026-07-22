'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Address } from 'viem'
import { rainApi } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { computeExcessCollateralCents, rainCentsToUsdcUnits } from '@/utils/balance.utils'

/**
 * After a card-limit decrease, returns the collateral held above the new
 * limit to the user's smart wallet so the card's backing always matches the
 * limit. The user sees exactly one thing: the passkey prompt for the admin
 * EIP-712 signature — the backend broadcasts via the stored session key, the
 * movement is collateral↔wallet (kind AUTO_REBALANCE → INTERNAL_TRANSFER,
 * hidden from history), and the unified displayed balance never changes.
 *
 * MUST run only AFTER the limit PATCH has succeeded: the auto-balancer
 * targets the DB cardLimit, so withdrawing first would race it topping the
 * collateral straight back up.
 *
 * Returns the cents actually returned (0 = nothing above the threshold, no
 * prompt shown).
 */
export const useReturnExcessCollateral = () => {
    const { overview } = useRainCardOverview()
    const { address: smartWalletAddress } = useWallet()
    const { signSpend } = useSignSpendBundle()
    const queryClient = useQueryClient()

    const returnExcess = useCallback(
        async (newLimitCents: number): Promise<number> => {
            const spendingPowerCents = overview?.balance?.spendingPower
            const excessCents = computeExcessCollateralCents(spendingPowerCents, newLimitCents)
            if (excessCents <= 0) return 0
            if (!smartWalletAddress) {
                throw new Error('Wallet not ready — please retry in a moment')
            }

            // Force collateral-only: routing would pick smart-only (a
            // self-transfer no-op) whenever the smart wallet covers the amount.
            const artifact = await signSpend({
                requiredUsdcAmount: rainCentsToUsdcUnits(excessCents),
                recipient: smartWalletAddress as Address,
                rainSpendingPower: rainCentsToUsdcUnits(spendingPowerCents),
                kind: 'AUTO_REBALANCE',
                forceStrategy: 'collateral-only',
            })
            if (artifact.strategy !== 'collateral-only') {
                throw new Error('Unexpected withdrawal strategy')
            }
            await rainApi.submitWithdrawal(artifact.rainWithdrawal)

            // Funds moved collateral → smart wallet; refresh both buckets so the
            // unified balance doesn't transiently double-count or crater.
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] }),
                queryClient.invalidateQueries({ queryKey: ['balance'] }),
            ])
            return excessCents
        },
        [overview, smartWalletAddress, signSpend, queryClient]
    )

    return { returnExcess }
}
