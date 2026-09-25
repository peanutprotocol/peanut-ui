'use client'

import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useCardSurfaceAccess } from '@/hooks/useCardSurfaceAccess'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import {
    type OnboardingState,
    canReachQrPay,
    holdsMoney,
    resolveOnboarding,
    selectFirstPaymentRoute,
} from '@/utils/activation-step.utils'
import { useMemo } from 'react'

interface ActivationStatus {
    /**
     * API activation (Lexicon v2): ≥1 card spend or QR pay on Mercado Pago/Pix.
     * Gates Rewards and referral UI. If the API omits it, false.
     */
    isActivated: boolean
    /** timestamp of activation, null if not yet activated */
    activatedAt: string | null
    /** the Home checklist rows and the first open step (utils/activation-step.utils.ts) */
    onboarding: OnboardingState
    /** every checklist row is done: Home leaves the checklist for the carousel */
    isOnboardingComplete: boolean
    /** true while user data is still loading */
    isLoading: boolean
}

/**
 * Home onboarding: Create account ✓ · Verify identity · Add money · Make the
 * first payment. The rules live in resolveOnboarding; this hook only gathers
 * the inputs, all from data Home already loads (/users/me, the wallet balance,
 * the card overview).
 */
export function useActivationStatus(): ActivationStatus {
    const { user } = useAuth()
    const { balance, isFetchingBalance } = useWallet()
    const { rails, channelOf } = useCapabilities()
    const { overview } = useRainCardOverview()
    const { canSpendPathViaCard } = useCardSurfaceAccess()
    const { cardInfo } = useCardInfo()
    const { status: identityStatus } = useIdentityVerification()

    const isLoading = !user || isFetchingBalance

    const derived = useMemo(() => {
        const isActivated = user?.user?.isActivated ?? false
        // Card eligibility is known once card info answered, or when a held card
        // settles it. Loading or a failed request is unknown, never "no card".
        // The Home card-prompt kill switch mutes every card arm; the QR path stands.
        const canSpendViaCard = underMaintenanceConfig.disableCardPromotion
            ? false
            : canSpendPathViaCard || (cardInfo !== undefined ? false : undefined)
        const residence = user?.residence
        const firstPaymentRoute = selectFirstPaymentRoute({
            canSpendViaCard,
            canPayQr: canReachQrPay(rails, channelOf, residence?.verified ?? residence?.declared),
        })
        const onboarding = resolveOnboarding({
            identityStatus: user?.user ? identityStatus : undefined,
            milestone: user?.user?.activationMilestone,
            isActivated,
            holdsMoney: holdsMoney(balance, overview?.balance),
            firstPaymentRoute,
        })
        return {
            isActivated,
            activatedAt: user?.user?.activatedAt ?? null,
            onboarding,
            isOnboardingComplete: onboarding.step === 'completed',
        }
    }, [
        user?.user,
        user?.residence,
        identityStatus,
        balance,
        overview?.balance,
        canSpendPathViaCard,
        cardInfo,
        rails,
        channelOf,
    ])

    return { ...derived, isLoading }
}
