'use client'

/**
 * <CardUnlockHistoryItem /> — activity-feed row for the "card unlocked"
 * milestone. Mirrors KycStatusItem's shape: a single Card row with an
 * icon, a title, a subtitle, and a click handler that opens a drawer
 * holding the ShareAssetD3 reveal.
 *
 * The row is rendered by HomeHistory + the history page when
 * `deriveCardUnlockEntry()` returns a non-null entry, sorted into the
 * feed by `timestamp` (same as KYC + Badge synthetic rows).
 */

import { type FC, type HTMLAttributes, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import { Icon } from '@/components/Global/Icons/Icon'
import { CardUnlockDrawer } from './CardUnlockDrawer'
import type { CardUnlockHistoryEntry } from './cardUnlock.types'

interface Props {
    entry: CardUnlockHistoryEntry
    position?: CardPosition
    className?: HTMLAttributes<HTMLDivElement>['className']
    /** Pulled from the auth store by the parent so we can render the asset
     *  in the drawer without re-fetching. */
    username?: string
    /** Full user-badges payload (with `earnedAt`) — drawer stamps every
     *  badge the user holds, not just the skip-the-line subset. */
    badges?: Array<{ code: string; iconUrl?: string | null; earnedAt?: string | Date | null }>
}

const VIA_COPY_KEYS = {
    badge: { title: 'badgeTitle', subtitle: 'badgeSubtitle' },
    admin: { title: 'adminTitle', subtitle: 'adminSubtitle' },
    'public-launch': { title: 'publicLaunchTitle', subtitle: 'publicLaunchSubtitle' },
} as const satisfies Record<CardUnlockHistoryEntry['via'], { title: string; subtitle: string }>

const CardUnlockHistoryItem: FC<Props> = ({ entry, position = 'single', className, username, badges }) => {
    const t = useTranslations('card.unlockHistory')
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const copyKeys = VIA_COPY_KEYS[entry.via]
    const title = t(copyKeys.title)

    return (
        <>
            {/* ListItem carries the row a11y (role=button, tabIndex, Enter/Space);
                the aria-label keeps the reveal affordance announced. */}
            <ListItem
                position={position}
                onClick={() => setIsDrawerOpen(true)}
                className={className}
                aria-label={t('openAssetAria', { title })}
                leading={
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-200">
                        <Icon name="credit-card" size={18} />
                    </div>
                }
                title={title}
                body={t(copyKeys.subtitle)}
            />

            {isDrawerOpen && (
                <CardUnlockDrawer
                    isOpen={isDrawerOpen}
                    onClose={() => setIsDrawerOpen(false)}
                    entry={entry}
                    username={username}
                    badges={badges}
                />
            )}
        </>
    )
}

export default CardUnlockHistoryItem
