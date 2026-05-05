'use client'

import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import useKycStatus from '@/hooks/useKycStatus'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useQuery } from '@tanstack/react-query'
import { cardApi, type CardInfoResponse } from '@/services/card'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useCallback, useEffect, useMemo, useState } from 'react'

export type ActivationStep = 'verify' | 'deposit' | 'card' | 'outbound' | 'completed'

interface ActivationStatus {
    /** whether user has completed activation funnel (kyc + first outbound tx) */
    isActivated: boolean
    /** timestamp of activation, null if not yet activated */
    activatedAt: string | null
    /** current step in the activation funnel */
    activationStep: ActivationStep
    /** true while user data is still loading */
    isLoading: boolean
    /** dismiss the card step — persists locally so it doesn't re-appear */
    dismissCardStep: () => void
}

const CARD_DISMISSED_STORAGE_KEY = 'peanut_card_activation_dismissed'

/**
 * derives the user's activation status for gating rewards/referral UI.
 *
 * activation funnel: registered → verified → funded → card → activated
 * (activated = kyc approved + ≥1 outbound transaction with fees)
 *
 * The `card` step only appears when the user is eligible for a Rain card
 * (hasCardAccess) but doesn't have an active one yet, and hasn't dismissed
 * it via "Maybe later". Otherwise the funnel skips straight to outbound.
 *
 * before backend ships isActivated, falls back to treating all users as activated
 * so no UI breaks during the transition.
 */
export function useActivationStatus(): ActivationStatus {
    const { user } = useAuth()
    const { balance, isFetchingBalance } = useWallet()
    const { isUserKycApproved } = useKycStatus()
    const { overview } = useRainCardOverview()
    const userId = user?.user?.userId

    const { data: cardInfo } = useQuery<CardInfoResponse>({
        queryKey: ['card-info', userId],
        queryFn: () => cardApi.getInfo(),
        enabled: !!userId,
        staleTime: 30_000,
    })

    // Read the dismissal flag after mount to avoid hydration mismatch.
    const [cardDismissed, setCardDismissed] = useState(false)
    useEffect(() => {
        if (typeof window === 'undefined') return
        setCardDismissed(localStorage.getItem(CARD_DISMISSED_STORAGE_KEY) === 'true')
    }, [])

    const dismissCardStep = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(CARD_DISMISSED_STORAGE_KEY, 'true')
        }
        setCardDismissed(true)
    }, [])

    const isLoading = !user || isFetchingBalance

    const derived = useMemo(() => {
        if (!user?.user) {
            return { isActivated: false, activatedAt: null, activationStep: 'verify' as ActivationStep }
        }

        // Default false: if BE omits the field (bug/outage), gate the referral UI rather than expose it
        const isActivated = user.user.isActivated ?? false
        const activatedAt = user.user.activatedAt ?? null

        // derive activation step from BE milestone + local balance
        const beMilestone = user.user.activationMilestone
        const hasBalance = balance !== undefined && balance !== null && Number(balance) > 0
        let activationStep: ActivationStep = 'completed'
        if (!isActivated) {
            if (beMilestone) {
                const milestoneToStep: Record<string, ActivationStep> = {
                    registered: 'verify',
                    verified: 'deposit',
                    funded: 'outbound',
                    activated: 'completed',
                }
                activationStep = milestoneToStep[beMilestone] ?? 'verify'
                // BE hasFunded only checks bridge/manteca deposits, not P2P or crypto.
                // if BE says "deposit" but user has balance (e.g. received via direct transfer),
                // skip to outbound step.
                if (activationStep === 'deposit' && hasBalance) {
                    activationStep = 'outbound'
                }
            } else {
                if (!isUserKycApproved) {
                    activationStep = 'verify'
                } else {
                    activationStep = hasBalance ? 'outbound' : 'deposit'
                }
            }
        }

        // Insert the card step between `deposit` and `outbound`: user has
        // funded but hasn't taken the card yet. Skipped if they can't access
        // the card flow, already have a card, or explicitly dismissed.
        if (activationStep === 'outbound') {
            const hasCardAccess = cardInfo?.hasCardAccess ?? false
            const hasCard = !!findActiveCard(overview)
            if (hasCardAccess && !hasCard && !cardDismissed) {
                activationStep = 'card'
            }
        }

        return { isActivated, activatedAt, activationStep }
    }, [user?.user, isUserKycApproved, balance, cardInfo?.hasCardAccess, overview, cardDismissed])

    return { ...derived, isLoading, dismissCardStep }
}
