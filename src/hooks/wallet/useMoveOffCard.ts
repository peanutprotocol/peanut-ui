'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Address } from 'viem'
import { rainApi } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { EXCESS_COLLATERAL_MIN_CENTS, rainCentsToUsdcUnits } from '@/utils/balance.utils'

/**
 * Moves money OFF the card — a collateral→smart-wallet return the user
 * chose (the "Move off card" action, or the excess after lowering the
 * on-card target). The user sees exactly one thing: the passkey prompt for
 * the admin EIP-712 signature — the backend broadcasts via the stored
 * session key, the movement is collateral↔wallet (kind AUTO_REBALANCE →
 * INTERNAL_TRANSFER, hidden from history), and the unified total never
 * changes.
 *
 * Callers that lower the on-card target MUST PATCH it first: the balancer
 * tops the card up to the target, so a return ahead of the PATCH races it
 * straight back. The inflow debounce also holds the returned money off the
 * card for a few minutes regardless.
 *
 * Returns the cents actually moved (0 = nothing to move, no prompt shown).
 */
export const useMoveOffCard = () => {
    const { overview } = useRainCardOverview()
    const { address: smartWalletAddress } = useWallet()
    const { signSpend } = useSignSpendBundle()
    const queryClient = useQueryClient()

    const moveOffCard = useCallback(
        async (amountCents: number): Promise<number> => {
            const spendingPowerCents = overview?.balance?.spendingPower
            if (spendingPowerCents == null || !Number.isFinite(spendingPowerCents) || spendingPowerCents <= 0) return 0
            if (!Number.isFinite(amountCents)) return 0
            // Floor both sides so we never sign for more than the collateral can
            // cover — sub-cent dust stays put.
            const cents = Math.min(Math.floor(amountCents), Math.floor(spendingPowerCents))
            if (cents < EXCESS_COLLATERAL_MIN_CENTS) return 0
            if (!smartWalletAddress) {
                throw new Error('Wallet not ready — please retry in a moment')
            }

            // Force collateral-only: routing would pick smart-only (a
            // self-transfer no-op) whenever the smart wallet covers the amount.
            const artifact = await signSpend({
                requiredUsdcAmount: rainCentsToUsdcUnits(cents),
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
            return cents
        },
        [overview, smartWalletAddress, signSpend, queryClient]
    )

    return { moveOffCard }
}
