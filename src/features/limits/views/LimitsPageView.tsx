'use client'

import { ActionListCard } from '@/components/ActionListCard'
import { getCardPosition } from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { Button } from '@/components/0_Bruddle/Button'
import { useIdentityVerification, type Region } from '@/hooks/useIdentityVerification'
import useKycStatus from '@/hooks/useKycStatus'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import CryptoLimitsSection from '../components/CryptoLimitsSection'
import FiatLimitsLockedCard from '../components/FiatLimitsLockedCard'
import { REST_OF_WORLD_GLOBE_ICON } from '@/assets'
import InfoCard from '@/components/Global/InfoCard'
import { getProviderRoute } from '../utils'

const LimitsPageView = () => {
    const router = useRouter()
    const { unlockedRegions, lockedRegions } = useIdentityVerification()
    const { isUserKycApproved, isUserBridgeKycUnderReview, isUserMantecaKycApproved } = useKycStatus()

    // check if user has any kyc at all
    const hasAnyKyc = isUserKycApproved

    // rest of world region config (static)
    const restOfWorldRegion: Region = {
        path: 'rest-of-the-world',
        name: 'Rest of the world',
        icon: REST_OF_WORLD_GLOBE_ICON,
    }

    // filter locked regions and check for rest of world
    const { filteredLockedRegions, hasRestOfWorld } = useMemo(() => {
        const filtered: Region[] = []
        let hasRoW = false
        for (const r of lockedRegions) {
            if (r.path === 'rest-of-the-world') {
                hasRoW = true
            } else {
                filtered.push(r)
            }
        }
        return { filteredLockedRegions: filtered, hasRestOfWorld: hasRoW }
    }, [lockedRegions])

    return (
        <div className="flex min-h-[inherit] flex-col space-y-6">
            <NavHeader
                title="Payment limits"
                onPrev={() => router.replace('/profile')}
                titleClassName="text-xl md:text-2xl"
            />

            {/* page description */}
            <InfoCard
                variant="info"
                description="Payment limits control how much you can send and receive. Limits vary by region and reset monthly or yearly."
            />

            {/* fiat limits section */}
            {!hasAnyKyc && <FiatLimitsLockedCard />}

            {/* unlocked regions */}
            {unlockedRegions.length > 0 && (
                <UnlockedRegionsList regions={unlockedRegions} hasMantecaKyc={isUserMantecaKycApproved} />
            )}

            {/* locked regions - only render if there are actual locked regions */}
            {filteredLockedRegions.length > 0 && (
                <LockedRegionsList regions={filteredLockedRegions} isBridgeKycPending={isUserBridgeKycUnderReview} />
            )}

            {/* rest of world - always shown with coming soon */}
            {hasRestOfWorld && (
                <div className="space-y-2">
                    <h2 className="font-bold">Other regions</h2>
                    <ActionListCard
                        leftIcon={
                            <Image
                                src={restOfWorldRegion.icon}
                                alt={restOfWorldRegion.name}
                                width={36}
                                height={36}
                                className="size-8 rounded-full object-cover"
                            />
                        }
                        position="single"
                        title={restOfWorldRegion.name}
                        onClick={() => {}}
                        isDisabled={true}
                        rightContent={<StatusBadge status="custom" customText="Coming soon" />}
                    />
                </div>
            )}

            {/* crypto limits section */}
            <CryptoLimitsSection />
        </div>
    )
}

export default LimitsPageView

interface UnlockedRegionsListProps {
    regions: Region[]
    hasMantecaKyc: boolean
}

const UnlockedRegionsList = ({ regions, hasMantecaKyc }: UnlockedRegionsListProps) => {
    const router = useRouter()

    return (
        <div>
            {regions.length > 0 && <h2 className="mb-2 font-bold">Unlocked regions</h2>}
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
                        const route = getProviderRoute(region.path, hasMantecaKyc)
                        router.push(route)
                    }}
                    description={region.description}
                    descriptionClassName="text-xs"
                    rightContent={
                        <StatusBadge
                            status="custom"
                            customText="Unlocked"
                            className="border border-success-5 bg-success-2 text-success-4"
                        />
                    }
                />
            ))}
        </div>
    )
}

interface LockedRegionsListProps {
    regions: Region[]
    isBridgeKycPending: boolean
}

const LockedRegionsList = ({ regions, isBridgeKycPending }: LockedRegionsListProps) => {
    const router = useRouter()

    // check if a region should show pending status
    // bridge kyc pending affects europe and north-america regions
    const isPendingRegion = (regionPath: string) => {
        if (!isBridgeKycPending) return false
        return regionPath === 'europe' || regionPath === 'north-america'
    }

    return (
        <div>
            {regions.length > 0 && <h2 className="mb-2 font-bold">Locked regions</h2>}
            {regions.map((region, index) => {
                const isPending = isPendingRegion(region.path)
                return (
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
                            if (!isPending) {
                                router.push(`/profile/identity-verification/${region.path}`)
                            }
                        }}
                        isDisabled={isPending}
                        description={region.description}
                        descriptionClassName="text-xs"
                        rightContent={
                            isPending ? (
                                <StatusBadge status="pending" />
                            ) : (
                                <Button
                                    shadowSize="4"
                                    size="small"
                                    className="h-6 w-6 rounded-full p-0 shadow-[0.12rem_0.12rem_0_#000000]"
                                >
                                    <div className="flex size-7 items-center justify-center">
                                        <span className="text-xs">›</span>
                                    </div>
                                </Button>
                            )
                        }
                    />
                )
            })}
        </div>
    )
}
