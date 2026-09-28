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
    canAlreadyTransact,
    holdsMoney,
    resolveOnboarding,
    selectFirstPaymentRoute,
} from '@/utils/activation-step.utils'
import { qrPayIsAPath, selectQrKycGate } from '@/features/payments/flows/qr-pay/qrKycGate.utils'
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
 * Home onboarding: Create account ✓ · Verify identity · Add money · First
 * payment. The rules live in resolveOnboarding; this hook only gathers
 * the inputs, all from data Home already loads (/users/me, the wallet balance,
 * the card overview).
 */
export function useActivationStatus(): ActivationStatus {
    const { user } = useAuth()
    const { balance, isFetchingBalance } = useWallet()
    const { canDo, rails, railsForProvider, nextActions, isLoading: isLoadingCapabilities } = useCapabilities()
    const { overview } = useRainCardOverview()
    const { canSpendPathViaCard, holdsCardOrApplication } = useCardSurfaceAccess()
    const { cardInfo, error: cardInfoError } = useCardInfo()
    const { status: identityStatus, isRegionRestricted, isTerminalFailure } = useIdentityVerification()

    const isLoading = !user || isFetchingBalance

    const derived = useMemo(() => {
        const isActivated = user?.user?.isActivated ?? false
        // Card eligibility is known once card info answered, or when a held card
        // settles it. Loading is unknown, never "no card": the row holds its
        // place so the arm does not flash. A failed request (retries spent)
        // settles as no card, so the row falls back to the QR answer instead
        // of a placeholder that never resolves.
        // The Home card-prompt kill switch mutes every card arm; the QR path stands.
        const canSpendViaCard = underMaintenanceConfig.disableCardPromotion
            ? false
            : canSpendPathViaCard || (cardInfo !== undefined || cardInfoError ? false : undefined)
        // QR asks the same gate the QR pay page uses, so the two never disagree.
        const qrGate = selectQrKycGate({
            isLoading: isLoadingCapabilities || !user,
            isRegionRestricted,
            isTerminalFailure,
            canPayManteca: canDo('pay', { provider: 'manteca' }),
            mantecaRails: railsForProvider('manteca'),
            nextActions,
        })
        const firstPaymentRoute = selectFirstPaymentRoute({
            canSpendViaCard,
            canPayQr: qrPayIsAPath(qrGate.kycGateState),
        })
        const onboarding = resolveOnboarding({
            identity: {
                status: user?.user ? identityStatus : undefined,
                isTerminalFailure,
                isRegionRestricted,
                canTransact: canAlreadyTransact(rails, isActivated),
            },
            milestone: user?.user?.activationMilestone,
            isActivated,
            holdsMoney: holdsMoney(balance, overview?.balance),
            firstPaymentRoute,
            cardHeld: holdsCardOrApplication,
        })
        return {
            isActivated,
            activatedAt: user?.user?.activatedAt ?? null,
            onboarding,
            isOnboardingComplete: onboarding.step === 'completed',
        }
    }, [
        user,
        identityStatus,
        isRegionRestricted,
        isTerminalFailure,
        balance,
        overview?.balance,
        canSpendPathViaCard,
        holdsCardOrApplication,
        cardInfo,
        cardInfoError,
        rails,
        isLoadingCapabilities,
        canDo,
        railsForProvider,
        nextActions,
    ])

    return { ...derived, isLoading }
}
