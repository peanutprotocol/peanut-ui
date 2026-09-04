'use client'

import { useMemo } from 'react'
import { useWallet } from './useWallet'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { isRainBalanceKnown, usdcUnitsToRainCents } from '@/utils/balance.utils'

/**
 * The two halves of the unified balance (TASK-22293): what sits ON the card
 * (Rain spending power plus top-ups in transit) and what sits OFF it (the
 * smart wallet — instant, passkey-only). Both in cents; `null` while either
 * side is not known yet, so a missing Rain read never paints as $0 on card.
 */
export interface BalanceSplit {
    onCardCents: number
    offCardCents: number
}

/**
 * Pure split for callers that already hold the wallet balance and the Rain
 * overview (the Home flow hook does — it must not mount `useWallet` twice).
 * Null until the user has an active card and both halves are known.
 */
export function computeBalanceSplit(
    balance: bigint | undefined,
    overview: Parameters<typeof findActiveCard>[0]
): BalanceSplit | null {
    if (!findActiveCard(overview)) return null
    if (balance === undefined || !isRainBalanceKnown(overview)) return null
    const b = overview?.balance
    return {
        onCardCents: Math.max(0, (b?.spendingPower ?? 0) + (b?.inTransitToCollateralCents ?? 0)),
        offCardCents: Number(usdcUnitsToRainCents(balance)),
    }
}

export function useBalanceSplit() {
    const { balance } = useWallet()
    const { overview, isLoading } = useRainCardOverview()
    const card = findActiveCard(overview)

    const onCardCents = useMemo(() => {
        if (!isRainBalanceKnown(overview)) return null
        const b = overview?.balance
        return Math.max(0, (b?.spendingPower ?? 0) + (b?.inTransitToCollateralCents ?? 0))
    }, [overview])

    const offCardCents = useMemo(
        () => (balance === undefined ? null : Number(usdcUnitsToRainCents(balance))),
        [balance]
    )

    return {
        card,
        hasActiveCard: !!card,
        policy: card?.collateral ?? null,
        onCardCents,
        offCardCents,
        offCardUnits: balance,
        isLoading: isLoading || balance === undefined,
    }
}
