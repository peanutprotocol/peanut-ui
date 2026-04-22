'use client'
import { type FC, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryStates, parseAsStringEnum } from 'nuqs'
import { cardApi, type CardInfoResponse } from '@/services/card'
import { useAuth } from '@/context/authContext'
import CardInfoScreen from '@/components/Card/CardInfoScreen'
import CardGeoScreen from '@/components/Card/CardGeoScreen'
import CardDetailsScreen from '@/components/Card/CardDetailsScreen'
import CardSuccessScreen from '@/components/Card/CardSuccessScreen'

type PioneerStep = 'info' | 'details' | 'geo' | 'success'

const STEP_ORDER: PioneerStep[] = ['info', 'details', 'geo', 'success']

interface Props {
    cardInfo: CardInfoResponse
    refetchCardInfo: () => void
}

const CardPioneerFlow: FC<Props> = ({ cardInfo, refetchCardInfo }) => {
    const router = useRouter()
    const { fetchUser } = useAuth()

    const [urlState, setUrlState] = useQueryStates(
        {
            step: parseAsStringEnum<PioneerStep>(['info', 'details', 'geo', 'success']),
            debugStep: parseAsStringEnum<PioneerStep>(['info', 'details', 'geo', 'success']),
        },
        { history: 'replace' }
    )

    const currentStep: PioneerStep = urlState.debugStep ?? urlState.step ?? 'info'
    const [purchaseError, setPurchaseError] = useState<string | null>(null)

    const goToStep = (step: PioneerStep) => setUrlState({ step })

    useEffect(() => {
        if (cardInfo.hasPurchased && currentStep !== 'success') {
            setUrlState({ step: 'success' })
        }
    }, [cardInfo.hasPurchased, currentStep, setUrlState])

    useEffect(() => {
        if (currentStep === 'success') {
            fetchUser()
            refetchCardInfo()
        }
    }, [currentStep, fetchUser, refetchCardInfo])

    const goToNextStep = () => {
        const currentIndex = STEP_ORDER.indexOf(currentStep)
        if (currentIndex < STEP_ORDER.length - 1) goToStep(STEP_ORDER[currentIndex + 1])
    }

    const goToPreviousStep = () => {
        const currentIndex = STEP_ORDER.indexOf(currentStep)
        if (currentIndex > 0) goToStep(STEP_ORDER[currentIndex - 1])
        else router.back()
    }

    const handleInitiatePurchase = async () => {
        setPurchaseError(null)
        try {
            const response = await cardApi.purchase()
            const { recipientAddress, chainId, tokenAmount, tokenSymbol, chargeUuid } = response
            const semanticUrl = `/${recipientAddress}@${chainId}/${tokenAmount}${tokenSymbol}?chargeId=${chargeUuid}&context=card-pioneer`
            router.push(semanticUrl)
        } catch (err) {
            const error = err as { code?: string; message?: string }
            if (error.code === 'ALREADY_PURCHASED') {
                refetchCardInfo()
                fetchUser()
                goToStep('success')
                return
            }
            console.error('Purchase initiation failed:', err)
            setPurchaseError(error.message || 'Failed to initiate purchase. Please try again.')
        }
    }

    switch (currentStep) {
        case 'info':
            return (
                <CardInfoScreen
                    onContinue={goToNextStep}
                    hasPurchased={cardInfo.hasPurchased}
                    slotsRemaining={cardInfo.slotsRemaining}
                    recentPurchases={cardInfo.recentPurchases}
                />
            )
        case 'details':
            return (
                <CardDetailsScreen
                    price={cardInfo.price ?? 10}
                    currentTier={cardInfo.currentTier ?? 0}
                    onContinue={goToNextStep}
                    onBack={goToPreviousStep}
                />
            )
        case 'geo':
            return (
                <CardGeoScreen
                    isEligible={cardInfo.isEligible ?? false}
                    eligibilityReason={cardInfo.eligibilityReason}
                    onContinue={goToNextStep}
                    onInitiatePurchase={handleInitiatePurchase}
                    onBack={goToPreviousStep}
                    purchaseError={purchaseError}
                />
            )
        case 'success':
            return <CardSuccessScreen onViewBadges={() => router.push('/badges')} />
        default:
            return (
                <CardInfoScreen
                    onContinue={goToNextStep}
                    hasPurchased={cardInfo.hasPurchased}
                    slotsRemaining={cardInfo.slotsRemaining}
                    recentPurchases={cardInfo.recentPurchases}
                />
            )
    }
}

export default CardPioneerFlow
