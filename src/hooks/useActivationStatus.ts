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

// v2 (2026-08-20): rotated when the card step moved AFTER deposit. The v1
// flag was written by users dismissing the mis-timed PRE-deposit banner —
// exactly the funded card-eligible cohort this change re-targets — so
// honoring it would permanently suppress the step for the people it is for.
// Worst case of the rotation: one extra "Maybe later".
const CARD_DISMISSED_STORAGE_KEY = 'peanut_card_activation_dismissed_v2'

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
        // The #2262 problem this must not fully resurrect — the Bridge/
        // region-picker KYC detour for card-only EU/NA users — is mitigated
        // (not guaranteed) by two best-effort guards: UnlockedRegions
        // redirects hasCardAccess users to /card before Bridge KYC starts
        // (skipped while its card queries are still loading), and /add-money
        // offers the KYC-free crypto path first (its bank rows still reach
        // Bridge KYC). Residual exposure equals the pre-#2262 baseline; the
        // full fix is the single-resolver consolidation (TASK-20837). The
        // `completed` arm is belt-and-braces only: no shipped surface renders
        // ActivationCTAs for an isActivated user (home swaps to the carousel),
        // so it can only matter in the isActivated=false + milestone-lag edge.
        const hasCardAccess = cardInfo?.hasCardAccess ?? false
        const hasCard = !!findActiveCard(overview)
        // Funded = the BE milestone says so, OR the live chain balance is
        // positive — a user whose inbound is still mid-poller (milestone stuck
        // at 'verified') has real money and must not be told "add money"
        // while the card step is withheld.
        const isFunded = activationStep === 'outbound' || activationStep === 'completed' || hasBalance
        if (isFunded && hasCardAccess && !hasCard && !cardDismissed && !underMaintenanceConfig.disableCardLaunchCTA) {
            activationStep = 'card'
        }

        return { isActivated, activatedAt, activationStep }
    }, [user?.user, isKycApproved, balance, cardInfo?.hasCardAccess, overview, cardDismissed])

    return { ...derived, isLoading, dismissCardStep }
}
