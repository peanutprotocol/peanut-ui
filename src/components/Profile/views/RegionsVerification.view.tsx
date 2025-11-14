'use client'

import { ActionListCard } from '@/components/ActionListCard'
import { getCardPosition } from '@/components/Global/Card'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { useIdentityVerification, type Region } from '@/hooks/useIdentityVerification'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import React from 'react'

const RegionsVerification = () => {
    const router = useRouter()
    const { unlockedRegions, lockedRegions } = useIdentityVerification()

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

                <h1 className="mt-5 font-bold">Locked regions</h1>
                <p className="mt-2 text-sm">Where do you want to send and receive money?</p>

                <RegionsList regions={lockedRegions} isLocked={true} />
            </div>
        </div>
    )
}

export default RegionsVerification

interface RegionsListProps {
    regions: Region[]
    isLocked: boolean
}
const RegionsList = ({ regions, isLocked }: RegionsListProps) => {
    const router = useRouter()
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
                        if (isLocked) {
                            router.push(`/profile/identity-verification/${region.path}`)
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
