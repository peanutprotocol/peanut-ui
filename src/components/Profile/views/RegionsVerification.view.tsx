'use client'

import { ActionListCard } from '@/components/ActionListCard'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import StartVerificationModal from '@/components/IdentityVerification/StartVerificationModal'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import { useIdentityVerification, getRegionIntent, type Region } from '@/hooks/useIdentityVerification'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useCallback, useRef } from 'react'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'

const RegionsVerification = () => {
    const router = useRouter()
    const { unlockedRegions, lockedRegions } = useIdentityVerification()
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
    // keeps the region display stable during modal close animation
    const displayRegionRef = useRef<Region | null>(null)
    if (selectedRegion) displayRegionRef.current = selectedRegion
    // persist region intent for the duration of the kyc session so token refresh
    // and status checks use the correct template after the confirmation modal closes
    const [activeRegionIntent, setActiveRegionIntent] = useState<KYCRegionIntent | undefined>(undefined)

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
        onKycSuccess: () => {
            setSelectedRegion(null)
            setActiveRegionIntent(undefined)
        },
        onManualClose: () => {
            setSelectedRegion(null)
            setActiveRegionIntent(undefined)
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
                visible={!!selectedRegion}
                onClose={handleModalClose}
                onStartVerification={handleStartKyc}
                selectedRegion={displayRegionRef.current}
                isLoading={isLoading}
            />

            {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}

            <SumsubKycWrapper
                visible={showWrapper}
                accessToken={accessToken}
                onClose={handleSumsubClose}
                onComplete={handleSdkComplete}
                onRefreshToken={refreshToken}
            />

            <KycVerificationInProgressModal
                isOpen={isVerificationProgressModalOpen}
                onClose={closeVerificationProgressModal}
            />
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
