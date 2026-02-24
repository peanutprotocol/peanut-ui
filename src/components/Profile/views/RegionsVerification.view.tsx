'use client'

import { ActionListCard } from '@/components/ActionListCard'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import StartVerificationModal from '@/components/IdentityVerification/StartVerificationModal'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import { KycProcessingModal } from '@/components/Kyc/modals/KycProcessingModal'
import { KycActionRequiredModal } from '@/components/Kyc/modals/KycActionRequiredModal'
import { KycRejectedModal } from '@/components/Kyc/modals/KycRejectedModal'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { useIdentityVerification, getRegionIntent, type Region } from '@/hooks/useIdentityVerification'
import useUnifiedKycStatus from '@/hooks/useUnifiedKycStatus'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { useAuth } from '@/context/authContext'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useCallback, useRef, useMemo } from 'react'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'

type ModalVariant = 'start' | 'processing' | 'action_required' | 'rejected'

// determine which modal to show based on sumsub status and clicked region intent
function getModalVariant(
    sumsubStatus: string | null,
    clickedRegionIntent: KYCRegionIntent | undefined,
    existingRegionIntent: string | null
): ModalVariant {
    // no verification or not started → start fresh
    if (!sumsubStatus || sumsubStatus === 'NOT_STARTED') return 'start'

    // different region intent → allow new verification
    if (existingRegionIntent && clickedRegionIntent && clickedRegionIntent !== existingRegionIntent) return 'start'

    switch (sumsubStatus) {
        case 'PENDING':
        case 'IN_REVIEW':
            return 'processing'
        case 'ACTION_REQUIRED':
            return 'action_required'
        case 'REJECTED':
        case 'FAILED':
            return 'rejected'
        default:
            return 'start'
    }
}

const RegionsVerification = () => {
    const router = useRouter()
    const { user, fetchUser } = useAuth()
    const { unlockedRegions, lockedRegions } = useIdentityVerification()
    const { sumsubStatus, sumsubRejectLabels, sumsubRejectType, sumsubVerificationRegionIntent } = useUnifiedKycStatus()
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
    // keeps the region display stable during modal close animation
    const displayRegionRef = useRef<Region | null>(null)
    if (selectedRegion) displayRegionRef.current = selectedRegion
    // persist region intent for the duration of the kyc session so token refresh
    // and status checks use the correct template after the confirmation modal closes
    const [activeRegionIntent, setActiveRegionIntent] = useState<KYCRegionIntent | undefined>(undefined)
    const [showBridgeTos, setShowBridgeTos] = useState(false)
    // skip StartVerificationView when re-submitting (user already consented)
    const [autoStartSdk, setAutoStartSdk] = useState(false)

    const sumsubFailureCount = useMemo(
        () =>
            user?.user?.kycVerifications?.filter((v) => v.provider === 'SUMSUB' && v.status === 'REJECTED').length ?? 0,
        [user]
    )

    const clickedRegionIntent = selectedRegion ? getRegionIntent(selectedRegion.path) : undefined
    const modalVariant = selectedRegion
        ? getModalVariant(sumsubStatus, clickedRegionIntent, sumsubVerificationRegionIntent)
        : null

    const handleFinalKycSuccess = useCallback(() => {
        setSelectedRegion(null)
        setActiveRegionIntent(undefined)
        setShowBridgeTos(false)
        setAutoStartSdk(false)
    }, [])

    // intercept sumsub approval to check for bridge ToS
    const handleKycApproved = useCallback(async () => {
        const updatedUser = await fetchUser()
        const rails = updatedUser?.rails ?? []
        const bridgeNeedsTos = rails.some(
            (r) => r.rail.provider.code === 'BRIDGE' && r.status === 'REQUIRES_INFORMATION'
        )

        if (bridgeNeedsTos) {
            setShowBridgeTos(true)
        } else {
            handleFinalKycSuccess()
        }
    }, [fetchUser, handleFinalKycSuccess])

    const {
        isLoading,
        error,
        showWrapper,
        accessToken,
        handleInitiateKyc,
        handleSdkComplete,
        handleClose: handleSumsubClose,
        refreshToken,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
    } = useSumsubKycFlow({
        regionIntent: activeRegionIntent,
        onKycSuccess: handleKycApproved,
        onManualClose: () => {
            setSelectedRegion(null)
            setActiveRegionIntent(undefined)
            setAutoStartSdk(false)
        },
    })

    const handleRegionClick = useCallback((region: Region) => {
        setSelectedRegion(region)
    }, [])

    const handleModalClose = useCallback(() => {
        setSelectedRegion(null)
    }, [])

    const handleStartKyc = useCallback(async () => {
        const intent = selectedRegion ? getRegionIntent(selectedRegion.path) : undefined
        if (intent) setActiveRegionIntent(intent)
        setSelectedRegion(null)
        await handleInitiateKyc(intent)
    }, [handleInitiateKyc, selectedRegion])

    // re-submission: skip StartVerificationView since user already consented
    const handleResubmitKyc = useCallback(async () => {
        setAutoStartSdk(true)
        await handleStartKyc()
    }, [handleStartKyc])

    return (
        <div className="flex min-h-[inherit] flex-col space-y-8">
            <NavHeader
                title="Regions & Verification"
                onPrev={() => router.replace('/profile')}
                titleClassName="text-xl md:text-2xl"
            />
            <div className="my-auto">
                <h1 className="font-bold">Unlocked regions</h1>
                <p className="mt-2 text-sm">
                    Transfer to and receive from any bank account and use supported payments methods.
                </p>

                {unlockedRegions.length === 0 && (
                    <EmptyState
                        title="You haven't unlocked any countries yet."
                        description="No countries unlocked yet. Complete verification to unlock countries and use supported payment methods."
                        icon="globe-lock"
                        containerClassName="mt-3"
                    />
                )}

                <RegionsList regions={unlockedRegions} isLocked={false} />

                {lockedRegions.length > 0 && (
                    <>
                        <h1 className="mt-5 font-bold">Locked regions</h1>
                        <p className="mt-2 text-sm">Where do you want to send and receive money?</p>

                        <RegionsList regions={lockedRegions} isLocked={true} onRegionClick={handleRegionClick} />
                    </>
                )}
            </div>

            <StartVerificationModal
                visible={modalVariant === 'start'}
                onClose={handleModalClose}
                onStartVerification={handleStartKyc}
                selectedRegion={displayRegionRef.current}
                isLoading={isLoading}
            />

            <KycProcessingModal visible={modalVariant === 'processing'} onClose={handleModalClose} />

            <KycActionRequiredModal
                visible={modalVariant === 'action_required'}
                onClose={handleModalClose}
                onResubmit={handleResubmitKyc}
                isLoading={isLoading}
                rejectLabels={sumsubRejectLabels}
            />

            <KycRejectedModal
                visible={modalVariant === 'rejected'}
                onClose={handleModalClose}
                onRetry={handleResubmitKyc}
                isLoading={isLoading}
                rejectLabels={sumsubRejectLabels}
                rejectType={sumsubRejectType}
                failureCount={sumsubFailureCount}
            />

            {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}

            <SumsubKycWrapper
                visible={showWrapper}
                accessToken={accessToken}
                onClose={handleSumsubClose}
                onComplete={handleSdkComplete}
                onRefreshToken={refreshToken}
                autoStart={autoStartSdk}
            />

            <KycVerificationInProgressModal
                isOpen={isVerificationProgressModalOpen}
                onClose={closeVerificationProgressModal}
            />

            <BridgeTosStep visible={showBridgeTos} onComplete={handleFinalKycSuccess} onSkip={handleFinalKycSuccess} />
        </div>
    )
}

export default RegionsVerification

interface RegionsListProps {
    regions: Region[]
    isLocked: boolean
    onRegionClick?: (region: Region) => void
}
const RegionsList = ({ regions, isLocked, onRegionClick }: RegionsListProps) => {
    return (
        <div className="mt-3">
            {regions.map((region, index) => (
                <ActionListCard
                    key={region.path}
                    leftIcon={
                        <Image
                            src={region.icon}
                            alt={region.name}
                            width={36}
                            height={36}
                            className="size-8 rounded-full object-cover"
                        />
                    }
                    position={getCardPosition(index, regions.length)}
                    title={region.name}
                    onClick={() => {
                        if (isLocked && onRegionClick) {
                            onRegionClick(region)
                        }
                    }}
                    isDisabled={!isLocked}
                    description={region.description}
                    descriptionClassName="text-xs"
                    rightContent={!isLocked ? <Icon name="check" className="size-4 text-success-1" /> : null}
                />
            ))}
        </div>
    )
}
