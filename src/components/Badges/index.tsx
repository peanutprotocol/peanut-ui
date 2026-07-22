'use client'

import Image from 'next/image'
import type { StaticImageData } from 'next/image'
import NavHeader from '../Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { getBadgeDisplayName, getBadgeIcon } from './badge.utils'
import { getCardPosition } from '../Global/Card/card.utils'
import EmptyState from '../Global/EmptyStates/EmptyState'
import { Icon } from '../Global/Icons/Icon'
import { BadgeDetailModal } from './BadgeDetailModal'
import { useMemo, useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useUserStore } from '@/redux/hooks'
import { ActionListCard } from '../ActionListCard'
import { useAuth } from '@/context/authContext'

type BadgeView = { title: string; description: string; logo: string | StaticImageData }

export const Badges = () => {
    const t = useTranslations('badges')
    const onBack = useSafeBack('/profile')
    const { user: authUser } = useUserStore()
    const { fetchUser } = useAuth()
    const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false)
    const [selectedBadge, setSelectedBadge] = useState<BadgeView | null>(null)

    // TODO: fetchUser from context may not be memoized - could cause unnecessary re-renders
    useEffect(() => {
        fetchUser()
    }, [fetchUser])

    // map api badges to view badges
    const badges: BadgeView[] = useMemo(() => {
        // get badges from user object and map to card fields
        const raw = authUser?.user?.badges || []
        return raw.map((b) => ({
            title: getBadgeDisplayName(b.code, b.name),
            description: b.description || '',
            logo: getBadgeIcon(b.code),
        }))
    }, [authUser?.user?.badges])

    if (!badges.length) {
        return (
            <div className="flex min-h-[inherit] flex-col items-center justify-center gap-8">
                <NavHeader title={t('yourBadges')} onPrev={onBack} />
                <div className="my-auto">
                    <EmptyState icon="achievements" title={t('emptyTitle')} description={t('emptyDescription')} />
                </div>
            </div>
        )
    }

    return (
        <div className="h-full w-full space-y-10">
            <NavHeader title={t('yourBadges')} onPrev={onBack} />
            <div className="space-y-4">
                <div>
                    {badges.map((badge, idx) => (
                        <ActionListCard
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
                                    // object-contain so non-square badge SVGs
                                    // (e.g. bug_whisperer.svg is ~1.41:1) keep
                                    // their aspect inside the 40×40 slot
                                    // instead of getting squished to 1:1.
                                    className="size-10 min-w-10 object-contain"
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
                    <span>{t('publicProfileNote')}</span>
                </div>
            </div>
            {selectedBadge && (
                <BadgeDetailModal
                    isOpen={isBadgeModalOpen}
                    onClose={() => {
                        setIsBadgeModalOpen(false)
                        setSelectedBadge(null)
                    }}
                    title={selectedBadge.title}
                    description={selectedBadge.description}
                    logo={selectedBadge.logo}
                />
            )}
        </div>
    )
}
