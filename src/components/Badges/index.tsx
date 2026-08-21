'use client'

import type { StaticImageData } from 'next/image'
import NavHeader from '../Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { getBadgeIcon } from './badge.utils'
import { useBadgeCopy } from './useBadgeCopy'
import { getCardPosition } from '../Global/Card/card.utils'
import EmptyState from '../Global/EmptyStates/EmptyState'
import { Icon } from '../Global/Icons/Icon'
import { BadgeDetailModal } from './BadgeDetailModal'
import { useMemo, useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useUserStore } from '@/redux/hooks'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { useAuth } from '@/context/authContext'
import { BadgeImage } from './BadgeImage'

type BadgeView = { code: string; title: string; description: string; logo: string | StaticImageData }

export const Badges = () => {
    const t = useTranslations('badges')
    const badgeCopy = useBadgeCopy()
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
        return raw.map((b) => {
            const copy = badgeCopy(b.code, b.name, b.description)
            return {
                code: b.code,
                title: copy.name,
                description: copy.description || '',
                logo: getBadgeIcon(b.code, b.iconUrl),
            }
        })
    }, [authUser?.user?.badges, badgeCopy])

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
        <div className="space-y-10 h-full w-full">
            <NavHeader title={t('yourBadges')} onPrev={onBack} />
            <div className="space-y-4">
                <div>
                    {badges.map((badge, idx) => (
                        <ListItem
                            key={idx}
                            title={badge.title}
                            // string body gets the native one-line truncation (was
                            // descriptionClassName="truncate"); no chevron (the old
                            // hidden-div hack suppressed it)
                            body={badge.description}
                            onClick={() => {
                                setSelectedBadge(badge)
                                setIsBadgeModalOpen(true)
                            }}
                            position={getCardPosition(idx, badges.length)}
                            leading={
                                <BadgeImage
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
                    code={selectedBadge.code}
                    title={selectedBadge.title}
                    description={selectedBadge.description}
                    logo={selectedBadge.logo}
                />
            )}
        </div>
    )
}
