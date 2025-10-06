'use client'

import Image from 'next/image'
import NavHeader from '../Global/NavHeader'
import { useRouter } from 'next/navigation'
import { PEANUTMAN_LOGO } from '@/assets'
import { SearchResultCard } from '../SearchUsers/SearchResultCard'
import { getCardPosition } from '../Global/Card'
import EmptyState from '../Global/EmptyStates/EmptyState'
import { Icon } from '../Global/Icons/Icon'
import ActionModal from '../Global/ActionModal'
import { useState } from 'react'

const tempBadges = [
    {
        title: 'Devconnect Badge',
        description: 'You became a Peanut user during Devconnect Buenos Aires',
        logo: PEANUTMAN_LOGO,
    },
    {
        title: 'More Restaurants',
        description: 'You payed at more than 5 restaurants using Peanut',
        logo: PEANUTMAN_LOGO,
    },
    {
        title: 'Big Spender',
        description: 'You spent more than $5000 using Peanut',
        logo: PEANUTMAN_LOGO,
    },
    {
        title: 'OG',
        description: 'You joined Peanut before other normies out there',
        logo: PEANUTMAN_LOGO,
    },
    {
        title: 'Beta Tester',
        description: 'You helped us test Peanut before it was launched', // todo: improve copy
        logo: PEANUTMAN_LOGO,
    },
    {
        title: 'Product Hunt',
        description: 'You upvoted Peanut on Product Hunt', // todo: improve copy
        logo: PEANUTMAN_LOGO,
    },
]

export const Badges = () => {
    const router = useRouter()
    const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false)
    const [selectedBadge, setSelectedBadge] = useState<(typeof tempBadges)[0] | null>(null)

    if (!tempBadges.length) {
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
                    {tempBadges.map((badge, idx) => (
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
                            position={getCardPosition(idx, tempBadges.length)}
                            leftIcon={<Image src={badge.logo} alt={badge.title} className="size-8 min-w-8" />}
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
                    icon={<Image src={selectedBadge?.logo} alt={selectedBadge?.title} className="size-16" />}
                    iconContainerClassName="bg-transparent size-16 my-4"
                    modalPanelClassName="m-0"
                    visible={isBadgeModalOpen}
                    onClose={() => {
                        setIsBadgeModalOpen(false)
                        setSelectedBadge(null)
                    }}
                    title={selectedBadge?.title}
                    description={selectedBadge?.description}
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
