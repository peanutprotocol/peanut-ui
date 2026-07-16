'use client'

import { ActionListCard } from '@/components/ActionListCard'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { deriveRegionAccess, pendingBankRailRegionPaths, type Region } from '@/utils/regions.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useLimits } from '@/hooks/useLimits'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useTranslations } from 'next-intl'
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
    const t = useTranslations('limits')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const goBack = useSafeBack('/profile', { replace: true })
    const { isKycApproved, rails } = useCapabilities()
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

    // "pending" badge per REGION: a region is pending only when a mid-flight
    // bank rail belongs to that region's jurisdiction. The old page-level
    // boolean badged every locked region off any pending rail — e.g. a pending
    // AR bank rail incorrectly badged Europe and North America.
    const pendingRegionPaths = useMemo(() => pendingBankRailRegionPaths(rails), [rails])

    // rest of world region config (static)
    const restOfWorldRegion: Region = {
        path: 'rest-of-the-world',
        name: t('restOfWorld'),
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
            <NavHeader title={t('title')} onPrev={goBack} titleClassName="text-xl md:text-2xl" />

            {/* page description */}
            <InfoCard variant="info" description={t('pageDescription')} />

            {/* fiat limits section */}
            {!hasAnyKyc && <FiatLimitsLockedCard />}

            {/* unlocked regions */}
            {unlockedRegions.length > 0 && (
                <UnlockedRegionsList regions={unlockedRegions} hasMantecaKyc={hasMantecaLimits} />
            )}

            {/* locked regions - only render if there are actual locked regions */}
            {filteredLockedRegions.length > 0 && (
                <LockedRegionsList regions={filteredLockedRegions} pendingRegionPaths={pendingRegionPaths} />
            )}

            {/* rest of world - always shown with coming soon */}
            {hasRestOfWorld && (
                <div className="space-y-2">
                    <h2 className="font-bold">{t('otherRegions')}</h2>
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
                        rightContent={<StatusBadge status="custom" customText={tCommon('comingSoon')} />}
                    />
                </div>
            )}

            {/* card limits — separate from KYC/region limits; managed per-card via Rain */}
            {activeCard && (
                <div className="space-y-2">
                    <h2 className="font-bold">{t('cardLimits.title')}</h2>
                    <ActionListCard
                        position="single"
                        leftIcon={<Icon name="credit-card" size={28} />}
                        title={t('cardLimits.manage')}
                        description={t('cardLimits.description')}
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
    const t = useTranslations('limits')
    const router = useRouter()

    return (
        <div>
            {regions.length > 0 && <h2 className="mb-2 font-bold">{t('unlockedRegions')}</h2>}
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
    pendingRegionPaths: Set<string>
}

const LockedRegionsList = ({ regions, pendingRegionPaths }: LockedRegionsListProps) => {
    const t = useTranslations('limits')
    const tCommon = useTranslations('common')
    const router = useRouter()

    // a region shows pending only when one of ITS bank rails is mid-flight
    const isPendingRegion = (regionPath: string) => pendingRegionPaths.has(regionPath)

    return (
        <div>
            {regions.length > 0 && <h2 className="mb-2 font-bold">{t('lockedRegions')}</h2>}
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
                        rightContent={isPending && <StatusBadge status="pending" customText={tCommon('pending')} />}
                    />
                )
            })}
        </div>
    )
}
