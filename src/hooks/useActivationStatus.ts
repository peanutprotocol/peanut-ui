'use client'

import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useQuery } from '@tanstack/react-query'
import { cardApi, type CardInfoResponse } from '@/services/card'
import { findActiveCard } from '@/components/Card/cardState.utils'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { useCallback, useEffect, useMemo, useState } from 'react'

export type ActivationStep = 'verify' | 'deposit' | 'card' | 'outbound' | 'completed'

interface ActivationStatus {
    /** whether user has activated (≥1 spend: card spend or QR spend on Mercado Pago/Pix) */
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
 * (activated = ≥1 SPEND transaction: card spend or QR spend on Mercado Pago/Pix —
 * other outbound tx kinds like send links, offramps and withdrawals no longer
 * count; the BE computes `isActivated`/`activationMilestone` on /users/me and
 * this hook just consumes them, so it inherits the definition automatically)
 *
 * The `card` step only appears when the user is FUNDED (or already activated),
 * eligible for a Rain card (hasCardAccess), doesn't hold an active one yet,
 * and hasn't dismissed it via "Maybe later" — card comes after deposit, never
 * before verify/deposit. Otherwise the funnel goes to the spend step
 * (`outbound` — step id kept for continuity, it now means "make your first spend").
 *
 * if the BE omits isActivated (bug/outage), falls back to false so gated UI
 * (rewards/referral) stays hidden rather than leaking.
 */
export function useActivationStatus(): ActivationStatus {
    const { user } = useAuth()
    const { balance, isFetchingBalance } = useWallet()
    const { isKycApproved } = useCapabilities()
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
            } else {
                if (!isKycApproved) {
                    activationStep = 'verify'
                } else {
                    activationStep = hasBalance ? 'outbound' : 'deposit'
                }
            }
        }

        // Card surfaces for eligible users — AFTER money is in. An eligible
        // user holds a skip badge (e.g. WAITLIST_SKIP) or an explicit admin
        // grant — both collapse into `cardInfo.hasCardAccess` on the BE, so
        // gating here IS gating on the badge.
        //
        // The funnel trunk is verify → deposit → card → first spend (decided
        // 2026-07-13, regressed by the global card-first override of #2262,
        // reaffirmed 2026-08-20): an unfunded user who is steered to the card
        // first mints plastic with nothing to spend — the Brazil campaign
        // cohort showed ~1% activation on that path. So the card step only
        // replaces `outbound`/`completed` (funded states); `verify` and
        // `deposit` keep the trunk.
        //
        // The #2262 problem this MUST not resurrect — the Bridge/region-picker
        // KYC detour for card-only EU/NA users — is guarded independently:
        // UnlockedRegions redirects hasCardAccess users to /card before any
        // Bridge KYC starts, and /add-money lists the KYC-free crypto path
        // first. Still fires for already-activated users who simply never took
        // the card (the funnel would otherwise be `completed`).
        const hasCardAccess = cardInfo?.hasCardAccess ?? false
        const hasCard = !!findActiveCard(overview)
        const isFunded = activationStep === 'outbound' || activationStep === 'completed'
        if (isFunded && hasCardAccess && !hasCard && !cardDismissed && !underMaintenanceConfig.disableCardLaunchCTA) {
            activationStep = 'card'
        }

        return { isActivated, activatedAt, activationStep }
    }, [user?.user, isKycApproved, balance, cardInfo?.hasCardAccess, overview, cardDismissed])

    return { ...derived, isLoading, dismissCardStep }
}
