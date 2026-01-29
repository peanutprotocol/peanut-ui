'use client'
import { type FC, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryStates, parseAsStringEnum } from 'nuqs'
import { useQuery } from '@tanstack/react-query'
import { cardApi, type CardInfoResponse } from '@/services/card'
import { useAuth } from '@/context/authContext'

// Screen components
import CardInfoScreen from '@/components/Card/CardInfoScreen'
import CardGeoScreen from '@/components/Card/CardGeoScreen'
import CardDetailsScreen from '@/components/Card/CardDetailsScreen'
import CardSuccessScreen from '@/components/Card/CardSuccessScreen'
import Loading from '@/components/Global/Loading'
import { Button } from '@/components/0_Bruddle/Button'
import PageContainer from '@/components/0_Bruddle/PageContainer'

// Step types for the card pioneer flow
// Flow: info -> details -> geo -> success
// (purchase happens inline on details screen, navigates to payment page)
type CardStep = 'info' | 'details' | 'geo' | 'success'

const STEP_ORDER: CardStep[] = ['info', 'details', 'geo', 'success']

const CardPioneerPage: FC = () => {
    const router = useRouter()
    const { user, fetchUser } = useAuth()

    // URL state for step navigation
    // Example: /card?step=info or /card?step=success
    const [urlState, setUrlState] = useQueryStates(
        {
            step: parseAsStringEnum<CardStep>(['info', 'details', 'geo', 'success']),
            // Debug params for testing
            debugStep: parseAsStringEnum<CardStep>(['info', 'details', 'geo', 'success']),
        },
        { history: 'replace' } // Use replace so back button exits flow instead of cycling steps
    )

    // Derive current step from URL (debug takes priority)
    const currentStep: CardStep = urlState.debugStep ?? urlState.step ?? 'info'

    // No local state needed - purchase navigates directly to payment page

    // Fetch card info
    const {
        data: cardInfo,
        isLoading,
        error: fetchError,
        refetch: refetchCardInfo,
    } = useQuery<CardInfoResponse>({
        queryKey: ['card-info'],
        queryFn: () => cardApi.getInfo(),
        enabled: !!user?.user?.userId,
        staleTime: 30_000, // 30 seconds
    })

    // Step navigation helpers
    const goToStep = (step: CardStep) => {
        setUrlState({ step })
    }

    // Redirect to success if already purchased
    useEffect(() => {
        if (cardInfo?.hasPurchased && currentStep !== 'success') {
            setUrlState({ step: 'success' })
        }
    }, [cardInfo?.hasPurchased, currentStep, setUrlState])

    // Skip geo screen if user is already eligible (auto-redirect)
    // This handles direct navigation to /card?step=geo when user is verified & eligible
    useEffect(() => {
        if (currentStep === 'geo' && cardInfo?.isEligible) {
            goToStep('success')
        }
    }, [currentStep, cardInfo?.isEligible, goToStep])

    const goToNextStep = () => {
        const currentIndex = STEP_ORDER.indexOf(currentStep)
        const nextStep = STEP_ORDER[currentIndex + 1]

        // Skip geo check if user is already eligible (already KYC'd and in eligible country)
        // This avoids showing a redundant "You're eligible!" screen
        // Ineligible users will see the geo screen with appropriate messaging
        if (nextStep === 'geo' && cardInfo?.isEligible) {
            // Jump directly to success screen
            goToStep('success')
            return
        }

        if (currentIndex < STEP_ORDER.length - 1) {
            goToStep(nextStep)
        }
    }

    const goToPreviousStep = () => {
        const currentIndex = STEP_ORDER.indexOf(currentStep)
        if (currentIndex > 0) {
            goToStep(STEP_ORDER[currentIndex - 1])
        } else {
            router.back()
        }
    }

    // Handle purchase completion (called when user already purchased)
    const handlePurchaseComplete = () => {
        refetchCardInfo()
        fetchUser()
        goToStep('success')
    }

    // Loading state
    if (isLoading && !cardInfo) {
        return (
            <div className="flex min-h-[inherit] w-full items-center justify-center">
                <Loading />
            </div>
        )
    }

    // Error state
    if (fetchError) {
        return (
            <div className="flex min-h-[inherit] w-full flex-col items-center justify-center gap-4 p-4">
                <p className="text-center text-n-1">Failed to load card info. Please try again.</p>
                <Button onClick={() => refetchCardInfo()} variant="purple" shadowSize="4">
                    Retry
                </Button>
            </div>
        )
    }

    // Render the appropriate screen based on current step
    // Flow: info -> details -> (payment page) -> success
    // Note: geo step only shown if user is ineligible
    const renderScreen = () => {
        switch (currentStep) {
            case 'info':
                return (
                    <CardInfoScreen
                        onContinue={() => goToNextStep()}
                        hasPurchased={cardInfo?.hasPurchased ?? false}
                        slotsRemaining={cardInfo?.slotsRemaining}
                    />
                )
            case 'details':
                return (
                    <CardDetailsScreen
                        price={cardInfo?.price ?? 10}
                        currentTier={cardInfo?.currentTier ?? 0}
                        onPurchaseComplete={handlePurchaseComplete}
                        onBack={() => goToPreviousStep()}
                    />
                )
            case 'geo':
                return (
                    <CardGeoScreen
                        isEligible={cardInfo?.isEligible ?? false}
                        eligibilityReason={cardInfo?.eligibilityReason}
                        onContinue={() => goToNextStep()}
                        onBack={() => goToPreviousStep()}
                    />
                )
            case 'success':
                return (
                    <CardSuccessScreen
                        onShareInvite={() => router.push('/profile?tab=invite')}
                        onViewBadges={() => router.push('/badges')}
                    />
                )
            default:
                return (
                    <CardInfoScreen
                        onContinue={() => goToNextStep()}
                        hasPurchased={cardInfo?.hasPurchased ?? false}
                        slotsRemaining={cardInfo?.slotsRemaining}
                    />
                )
        }
    }

    return <PageContainer>{renderScreen()}</PageContainer>
}

export default CardPioneerPage
