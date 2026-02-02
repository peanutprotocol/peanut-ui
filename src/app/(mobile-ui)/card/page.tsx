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
// Flow: info -> details -> geo -> (payment page) -> success
// Geo screen handles KYC verification prompt or eligibility blocking
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

    // Note: Auto-skip removed - user must explicitly click "Reserve my card" button
    // This prevents automatic redirects and gives user control over the purchase flow

    // Refetch user data when arriving at success screen
    // This ensures badge and other user data is up-to-date after payment
    useEffect(() => {
        if (currentStep === 'success') {
            fetchUser()
            refetchCardInfo()
        }
    }, [currentStep, fetchUser, refetchCardInfo])

    const goToNextStep = () => {
        const currentIndex = STEP_ORDER.indexOf(currentStep)
        if (currentIndex < STEP_ORDER.length - 1) {
            goToStep(STEP_ORDER[currentIndex + 1])
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

    // Initiate purchase and navigate to payment page
    const handleInitiatePurchase = async () => {
        try {
            const response = await cardApi.purchase()
            // Build semantic URL directly from response (avoids extra API call + loading state)
            // Format: /recipient@chainId/amountTOKEN?chargeId=uuid&context=card-pioneer
            const { recipientAddress, chainId, tokenAmount, tokenSymbol, chargeUuid } = response
            const semanticUrl = `/${recipientAddress}@${chainId}/${tokenAmount}${tokenSymbol}?chargeId=${chargeUuid}&context=card-pioneer`
            router.push(semanticUrl)
        } catch (err: any) {
            if (err.code === 'ALREADY_PURCHASED') {
                // User already purchased, redirect to success
                handlePurchaseComplete()
                return
            }
            // Handle error - show error state
            console.error('Purchase initiation failed:', err)
        }
    }

    // Handle purchase completion (called when user already purchased)
    const handlePurchaseComplete = () => {
        refetchCardInfo()
        fetchUser()
        goToStep('success')
    }

    // Loading state - also show loading if we haven't determined purchase status yet
    // This prevents flashing the info screen for users who have already purchased
    if ((isLoading && !cardInfo) || (cardInfo?.hasPurchased && currentStep !== 'success')) {
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
                        recentPurchases={cardInfo?.recentPurchases}
                    />
                )
            case 'details':
                return (
                    <CardDetailsScreen
                        price={cardInfo?.price ?? 10}
                        currentTier={cardInfo?.currentTier ?? 0}
                        onContinue={() => goToNextStep()}
                        onBack={() => goToPreviousStep()}
                    />
                )
            case 'geo':
                return (
                    <CardGeoScreen
                        isEligible={cardInfo?.isEligible ?? false}
                        eligibilityReason={cardInfo?.eligibilityReason}
                        onContinue={() => goToNextStep()}
                        onInitiatePurchase={handleInitiatePurchase}
                        onBack={() => goToPreviousStep()}
                    />
                )
            case 'success':
                return <CardSuccessScreen onViewBadges={() => router.push('/badges')} />
            default:
                return (
                    <CardInfoScreen
                        onContinue={() => goToNextStep()}
                        hasPurchased={cardInfo?.hasPurchased ?? false}
                        slotsRemaining={cardInfo?.slotsRemaining}
                        recentPurchases={cardInfo?.recentPurchases}
                    />
                )
        }
    }

    return <PageContainer>{renderScreen()}</PageContainer>
}

export default CardPioneerPage
