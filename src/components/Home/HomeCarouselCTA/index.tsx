'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Carousel from '@/components/Global/Carousel'
import CarouselCTA from './CarouselCTA'
import { type IconName } from '@/components/Global/Icons/Icon'
import { useHomeCarouselCTAs, type CarouselCTA as CarouselCTAType } from '@/hooks/useHomeCarouselCTAs'
import { perksApi, type PendingPerk } from '@/services/perks'
import { useAuth } from '@/context/authContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import { extractInviteeName } from '@/utils/general.utils'
import PerkClaimModal from '../PerkClaimModal'

const HomeCarouselCTA = () => {
    const { carouselCTAs, setCarouselCTAs } = useHomeCarouselCTAs()
    const { user } = useAuth()
    const queryClient = useQueryClient()

    // Perk claim modal state
    const [selectedPerk, setSelectedPerk] = useState<PendingPerk | null>(null)
    const [claimedPerkIds, setClaimedPerkIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        setClaimedPerkIds(new Set())
    }, [user?.user.userId])

    // Fetch pending perks
    const { data: pendingPerksData } = useQuery({
        queryKey: ['pendingPerks', user?.user.userId],
        queryFn: () => perksApi.getPendingPerks(),
        enabled: !!user?.user.userId,
    })

    // Listen for real-time perk notifications via WebSocket
    useWebSocket({
        username: user?.user.username ?? undefined,
        onPendingPerk: useCallback(() => {
            queryClient.invalidateQueries({ queryKey: ['pendingPerks'] })
        }, [queryClient]),
    })

    // Filter for Card Pioneer inviter rewards that haven't been claimed
    const cardPioneerPerks = useMemo(() => {
        return (
            pendingPerksData?.perks?.filter(
                (p) => p.name === 'Card Pioneer Inviter Reward' && !claimedPerkIds.has(p.id)
            ) || []
        )
    }, [pendingPerksData?.perks, claimedPerkIds])

    // Convert perks to carousel CTAs (these come first!)
    const perkCTAs: CarouselCTAType[] = useMemo(() => {
        return cardPioneerPerks.map((perk) => {
            const inviteeName = extractInviteeName(perk.reason)
            return {
                id: `perk-${perk.id}`,
                title: (
                    <p>
                        <b>+${perk.amountUsd}</b> reward ready!
                    </p>
                ),
                description: (
                    <p>
                        <b>{inviteeName}</b> joined Pioneers. Tap to claim.
                    </p>
                ),
                icon: 'gift' as IconName,
                iconContainerClassName: 'bg-primary-1',
                onClick: () => setSelectedPerk(perk),
                isPerkClaim: true,
                iconSize: 16,
            }
        })
    }, [cardPioneerPerks])

    // Combine perk CTAs (first) with regular CTAs
    const allCTAs = useMemo(() => {
        return [...perkCTAs, ...carouselCTAs]
    }, [perkCTAs, carouselCTAs])

    const handlePerkClaimed = useCallback((perkId: string) => {
        setClaimedPerkIds((prev) => new Set(prev).add(perkId))
    }, [])

    const handleModalClose = useCallback(() => {
        setSelectedPerk(null)
    }, [])

    // don't render carousel if there are no CTAs
    if (!allCTAs.length) return null

    return (
        <>
            <Carousel>
                {allCTAs.map((cta) => (
                    <CarouselCTA
                        key={cta.id}
                        title={cta.title}
                        description={cta.description}
                        icon={cta.icon as IconName}
                        onClose={() => {
                            // Use cta.onClose if provided (for notification prompt), otherwise filter from list
                            if (cta.onClose) {
                                cta.onClose()
                            } else {
                                setCarouselCTAs((prev) => prev.filter((c) => c.id !== cta.id))
                            }
                        }}
                        onClick={cta.onClick}
                        logo={cta.logo}
                        iconContainerClassName={cta.iconContainerClassName}
                        isPermissionDenied={cta.isPermissionDenied}
                        secondaryIcon={cta.secondaryIcon}
                        iconSize={16}
                        logoSize={cta.logoSize}
                        isPerkClaim={cta.isPerkClaim}
                    />
                ))}
            </Carousel>

            {/* Perk Claim Modal */}
            {selectedPerk && (
                <PerkClaimModal
                    perk={selectedPerk}
                    visible={!!selectedPerk}
                    onClose={handleModalClose}
                    onClaimed={handlePerkClaimed}
                />
            )}
        </>
    )
}

export default HomeCarouselCTA
