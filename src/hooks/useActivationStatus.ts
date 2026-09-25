'use client'

import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useCardSurfaceAccess } from '@/hooks/useCardSurfaceAccess'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import {
    type OnboardingState,
    hasQrPayRail,
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
    const { status: identityStatus } = useIdentityVerification()

    const isLoading = !user || isFetchingBalance

    const derived = useMemo(() => {
        const isActivated = user?.user?.isActivated ?? false
        const firstPaymentRoute = selectFirstPaymentRoute({
            // The Home card-prompt kill switch mutes every card arm; the QR path stands.
            canSpendViaCard: canSpendPathViaCard && !underMaintenanceConfig.disableCardPromotion,
            hasQrRail: hasQrPayRail(rails, channelOf),
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
    }, [user?.user, identityStatus, balance, overview?.balance, canSpendPathViaCard, rails, channelOf])

    return { ...derived, isLoading }
}
