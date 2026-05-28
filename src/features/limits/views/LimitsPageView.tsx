'use client'

import { ActionListCard } from '@/components/ActionListCard'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { deriveRegionAccess, type Region } from '@/utils/regions.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useLimits } from '@/hooks/useLimits'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { useSafeBack } from '@/hooks/useSafeBack'
import CryptoLimitsSection from '../components/CryptoLimitsSection'
import FiatLimitsLockedCard from '../components/FiatLimitsLockedCard'
import { REST_OF_WORLD_GLOBE_ICON } from '@/assets'
import InfoCard from '@/components/Global/InfoCard'
import { getProviderRoute } from '../utils'

const LimitsPageView = () => {
    const router = useRouter()
    const goBack = useSafeBack('/profile', { replace: true })
    const { isKycApproved, bankRails, rails } = useCapabilities()
    // MIGRATION-REVIEW: finishes the LimitsPageView migration the prior pass deferred
    // (f4eb9f70e left `useIdentityVerification` here for the region lists). unlockedRegions/
    // lockedRegions now derive from the capability rails via deriveRegionAccess — same Region
    // shape, faithful unlock mapping. See deriveRegionAccess for the flagged Sumsub-proxy gaps.
    const { unlockedRegions, lockedRegions } = useMemo(() => deriveRegionAccess(rails), [rails])
    const { hasMantecaLimits } = useLimits()
    const { overview: rainCardOverview } = useRainCardOverview()
    const activeCard = findActiveCard(rainCardOverview)

    // check if user has any kyc at all → any enabled rail unlocks the fiat-limits section.
    // MIGRATION-REVIEW: old `isUserKycApproved` (any provider approved) → `isKycApproved` (any enabled
    // rail). Equivalent for the limits-unlock gate.
    const hasAnyKyc = isKycApproved

    // "pending" badge fires when any bank rail is mid-flight (`pending` = BE
    // provisioning, `requires-info` = user must finish TOS/proof). Provider-blind
    // via bankRails — picks up Manteca's PIX_BR bank rail in addition to Bridge's.
    const isBankRailPending = bankRails().some((rail) => rail.status === 'pending' || rail.status === 'requires-info')

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
            <NavHeader title="Payment limits" onPrev={goBack} titleClassName="text-xl md:text-2xl" />

            {/* page description */}
            <InfoCard
                variant="info"
                description="Payment limits control how much you can send and receive. Limits vary by region and reset monthly or yearly."
            />

            {/* fiat limits section */}
            {!hasAnyKyc && <FiatLimitsLockedCard />}

            {/* unlocked regions */}
            {unlockedRegions.length > 0 && (
                <UnlockedRegionsList regions={unlockedRegions} hasMantecaKyc={hasMantecaLimits} />
            )}

            {/* locked regions - only render if there are actual locked regions */}
            {filteredLockedRegions.length > 0 && (
                <LockedRegionsList regions={filteredLockedRegions} isBankRailPending={isBankRailPending} />
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

            {/* card limits — separate from KYC/region limits; managed per-card via Rain */}
            {activeCard && (
                <div className="space-y-2">
                    <h2 className="font-bold">Card limits</h2>
                    <ActionListCard
                        position="single"
                        leftIcon={<Icon name="credit-card" size={28} />}
                        title="Manage card limits"
                        description="Transaction cap for your Peanut card."
                        onClick={() => router.push('/card/limit')}
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
                />
            ))}
        </div>
    )
}

interface LockedRegionsListProps {
    regions: Region[]
    isBankRailPending: boolean
}

const LockedRegionsList = ({ regions, isBankRailPending }: LockedRegionsListProps) => {
    const router = useRouter()

    // check if a region should show pending status
    // bridge kyc pending affects europe and north-america regions
    const isPendingRegion = (regionPath: string) => {
        if (!isBankRailPending) return false
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
                                router.push('/profile/identity-verification')
                            }
                        }}
                        isDisabled={isPending}
                        description={region.description}
                        descriptionClassName="text-xs"
                        rightContent={isPending && <StatusBadge status="pending" />}
                    />
                )
            })}
        </div>
    )
}
