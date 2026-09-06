'use client'

import { useMemo } from 'react'
import { useWallet } from './useWallet'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { isRainBalanceKnown } from '@/utils/balance.utils'

/** Display / bound conversion: floor to the cent. `usdcUnitsToRainCents` rounds
 *  UP for Rain withdrawal inputs and must not size a Max the wallet cannot fund. */
export const usdcUnitsToDisplayCents = (units: bigint): number => Number(units / 10_000n)

/**
 * The two halves of the unified balance (TASK-22293): what sits ON the card
 * (Rain spending power plus top-ups in transit) and what sits OFF it (the
 * smart wallet — instant, passkey-only). Both in cents; `null` while either
 * side is not known yet, so a missing Rain read never paints as $0 on card.
 */
export interface BalanceSplit {
    /** Landed Rain spending power — what the card can spend right now. */
    onCardCents: number
    /** Top-ups that left the wallet but Rain has not credited yet. */
    pendingToCardCents: number
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
        onCardCents: Math.max(0, Math.floor(b?.spendingPower ?? 0)),
        pendingToCardCents: Math.max(0, Math.floor(b?.inTransitToCollateralCents ?? 0)),
        offCardCents: usdcUnitsToDisplayCents(balance),
    }
}

export function useBalanceSplit() {
    const { balance } = useWallet()
    const { overview, isLoading } = useRainCardOverview()
    const card = findActiveCard(overview)

    // Landed only: what the card can spend and what can be moved off it.
    // In-transit top-ups are reported separately — they are neither spendable
    // by the card nor withdrawable until Rain credits them.
    const onCardCents = useMemo(() => {
        if (!isRainBalanceKnown(overview)) return null
        return Math.max(0, Math.floor(overview?.balance?.spendingPower ?? 0))
    }, [overview])
    const pendingToCardCents = useMemo(
        () =>
            isRainBalanceKnown(overview)
                ? Math.max(0, Math.floor(overview?.balance?.inTransitToCollateralCents ?? 0))
                : 0,
        [overview]
    )

    const offCardCents = useMemo(() => (balance === undefined ? null : usdcUnitsToDisplayCents(balance)), [balance])

    return {
        card,
        hasActiveCard: !!card,
        policy: card?.collateral ?? null,
        onCardCents,
        pendingToCardCents,
        offCardCents,
        offCardUnits: balance,
        isLoading: isLoading || balance === undefined,
    }
}
