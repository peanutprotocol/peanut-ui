'use client'

import Image from 'next/image'
import type { StaticImageData } from 'next/image'
import NavHeader from '../Global/NavHeader'
import { useRouter } from 'next/navigation'
import { getBadgeIcon } from './badge.utils'
import { SearchResultCard } from '../SearchUsers/SearchResultCard'
import { getCardPosition } from '../Global/Card'
import EmptyState from '../Global/EmptyStates/EmptyState'
import { Icon } from '../Global/Icons/Icon'
import ActionModal from '../Global/ActionModal'
import { useMemo, useState } from 'react'
import { useUserStore } from '@/redux/hooks'

type BadgeView = { title: string; description: string; logo: string | StaticImageData }

export const Badges = () => {
    const router = useRouter()
    const { user: authUser } = useUserStore()
    const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false)
    const [selectedBadge, setSelectedBadge] = useState<BadgeView | null>(null)

    // map api badges to view badges
    const badges: BadgeView[] = useMemo(() => {
        // get badges from user object and map to card fields
        const raw = authUser?.user?.badges || []
        return raw.map((b) => ({
            title: b.name,
            description: b.description || '',
            logo: getBadgeIcon(b.code),
        }))
    }, [authUser?.user?.badges])

    if (!badges.length) {
        return (
            <div className="flex min-h-[inherit] flex-col items-center justify-center gap-8">
                <NavHeader
                    title="Your Badges"
                    onPrev={() => {
                        router.back()
                    }}
                />
                <div className="my-auto">
                    <EmptyState
                        icon="achievements"
                        title="No badges found"
                        description="Earn badges as you use Peanut. Make payments, invite friends, and join events to unlock them and display them on your profile."
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="h-full w-full space-y-10">
            <NavHeader
                title="Your Badges"
                onPrev={() => {
                    router.back()
                }}
            />
            <div className="space-y-4">
                <div>
                    {badges.map((badge, idx) => (
                        <SearchResultCard
                            key={idx}
                            title={badge.title}
                            rightContent={<div className="hidden" />}
                            description={badge.description}
                            descriptionClassName="truncate"
                            onClick={() => {
                                setSelectedBadge(badge)
                                setIsBadgeModalOpen(true)
                            }}
                            position={getCardPosition(idx, badges.length)}
                            leftIcon={
                                <Image
                                    src={badge.logo}
                                    alt={badge.title}
                                    className="size-10 min-w-10"
                                    height={100}
                                    width={100}
                                    unoptimized
                                />
                            }
                        />
                    ))}
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-grey-1">
                    <Icon name="info" width={16} height={16} />
                    <span>These Badges are displayed on your public profile.</span>
                </div>
            </div>
            {selectedBadge && (
                <ActionModal
                    icon={
                        <Image
                            height={120}
                            width={120}
                            src={selectedBadge.logo}
                            alt={selectedBadge.title}
                            className="w-30 object-contain"
                            unoptimized
                        />
                    }
                    iconContainerClassName="bg-transparent min-w-30 h-auto"
                    modalPanelClassName="m-0"
                    visible={isBadgeModalOpen}
                    onClose={() => {
                        setIsBadgeModalOpen(false)
                        setSelectedBadge(null)
                    }}
                    title={selectedBadge.title}
                    description={selectedBadge.description}
                    ctas={[
                        {
                            text: 'Got it!',
                            onClick: () => {
                                setIsBadgeModalOpen(false)
                                setSelectedBadge(null)
                            },
                            shadowSize: '4',
                        },
                    ]}
                />
            )}
        </div>
    )
}
