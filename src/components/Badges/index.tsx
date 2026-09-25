'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { CARD_SURFACE } from '@/components/0_Bruddle/Card'
import Badge from '@/components/Global/Badges/Badge'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { BADGE_CATALOG } from '@/constants/query.consts'
import { displayableBadges } from '@/constants/badges.consts'
import { useAuth } from '@/context/authContext'
import { useSafeBack } from '@/hooks/useSafeBack'
import { getBadgeCatalog, type BadgeUnlockRequirement } from '@/services/badges'
import { twMerge } from '@/utils/tw'
import { BadgeDetailDrawer } from './BadgeDetailDrawer'
import { BadgeImage } from './BadgeImage'
import { BadgeMysteryTile } from './BadgeMysteryTile'
import { buildBadgeCollection, type BadgeView } from './badge.types'
import { getBadgeIcon } from './badge.utils'
import { useBadgeCopy } from './useBadgeCopy'

export const Badges = () => {
    const t = useTranslations('badges')
    const badgeCopy = useBadgeCopy()
    const onBack = useSafeBack('/profile')
    const { user: authUser, fetchUser } = useAuth()
    const [selectedBadge, setSelectedBadge] = useState<BadgeView | null>(null)

    useEffect(() => {
        void fetchUser()
    }, [fetchUser])

    const catalog = useQuery({
        queryKey: [BADGE_CATALOG],
        queryFn: getBadgeCatalog,
        enabled: !!authUser,
        staleTime: 15 * 60 * 1000,
    })

    const badges = useMemo(
        () =>
            buildBadgeCollection(displayableBadges(authUser?.user?.badges || []), catalog.data || []).map((badge) => {
                const copy = badgeCopy(badge.code, badge.name, badge.description)
                return {
                    ...badge,
                    name: copy.name,
                    description: copy.description || '',
                    logo: getBadgeIcon(badge.code, badge.iconUrl),
                }
            }),
        [authUser?.user?.badges, badgeCopy, catalog.data]
    )

    const unlockText = (unlock?: BadgeUnlockRequirement) => {
        if (!unlock) return t('unlock.specialRecognition')
        switch (unlock.kind) {
            case 'invites':
                return t('unlock.invites', { target: unlock.target })
            case 'rewards':
                return t('unlock.rewards', { targetUsd: unlock.targetUsd })
            case 'identity_verification':
                return t('unlock.identityVerification')
            case 'card_purchase':
                return t('unlock.cardPurchase')
            case 'card_spend':
                return t('unlock.cardSpend', { targetUsd: unlock.targetUsd })
            case 'ens_payment':
                return t('unlock.ensPayment')
            case 'campaign':
                return t('unlock.campaign')
            case 'special_recognition':
                return t('unlock.specialRecognition')
        }
    }

    if (catalog.isPending) {
        return (
            <div className="flex min-h-inherit flex-col gap-8">
                <NavHeader title={t('title')} onPrev={onBack} />
                <div className="my-auto flex justify-center">
                    <Loading variant="mascot" />
                </div>
            </div>
        )
    }

    if (!badges.length) {
        return (
            <div className="flex min-h-inherit flex-col gap-8">
                <NavHeader title={t('title')} onPrev={onBack} />
                <div className="my-auto">
                    <EmptyState
                        concept="badges"
                        title={catalog.isError ? t('loadErrorTitle') : t('emptyTitle')}
                        description={catalog.isError ? t('loadErrorDescription') : t('emptyDescription')}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full w-full flex-col gap-10">
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-2" aria-label={t('collectionLabel')}>
                    {badges.map((badge) => (
                        <button
                            key={badge.code}
                            type="button"
                            aria-label={`${badge.name}, ${badge.earned ? t('earned') : t('locked')}`}
                            onClick={() => setSelectedBadge(badge)}
                            className={twMerge(
                                // Two tiles per row on every phone: three squeezed names and copy at 320-430px
                                // (TASK-22677). The art is a square 3/4 of the tile width, so it scales with the
                                // tile at every width and reserves its box before the image loads (no layout
                                // shift). The Earned pill may overlap the art's corner (TASK-23054), never the text.
                                `relative flex min-w-0 flex-col items-center ${CARD_SURFACE} px-2 pt-2 pb-3 text-center focus-visible:outline-[3px] focus-visible:outline-action-focus`,
                                !badge.earned && 'bg-background-disabled'
                            )}
                        >
                            {badge.earned && (
                                <Badge status="completed" customText={t('earned')} className="absolute top-1 right-1" />
                            )}
                            <BadgeImage
                                src={badge.logo!}
                                alt=""
                                className={twMerge(
                                    'aspect-square h-auto w-3/4 object-contain',
                                    !badge.earned && 'opacity-40 grayscale'
                                )}
                                height={100}
                                width={100}
                                unoptimized
                            />
                            <span className="mt-2 line-clamp-2 h-8 w-full text-label-m">{badge.name}</span>
                            {/* two lines: the tap opens the detail drawer with the full description */}
                            <span className="line-clamp-2 h-8 w-full text-body-xs text-foreground-secondary">
                                {badge.description}
                            </span>
                        </button>
                    ))}
                    <BadgeMysteryTile />
                </div>

                <p className="text-center text-body-xs text-foreground-secondary">{t('publicProfileNote')}</p>
            </div>
            {selectedBadge && (
                <BadgeDetailDrawer
                    isOpen
                    onClose={() => setSelectedBadge(null)}
                    code={selectedBadge.code}
                    title={selectedBadge.name}
                    description={selectedBadge.description}
                    logo={selectedBadge.logo!}
                    earned={selectedBadge.earned}
                    unlockText={selectedBadge.earned ? undefined : unlockText(selectedBadge.unlock)}
                />
            )}
        </div>
    )
}
