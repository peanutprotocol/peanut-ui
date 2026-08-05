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
import Card from '@/components/Global/Card'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import { Icon } from '@/components/Global/Icons/Icon'
import { twMerge } from 'tailwind-merge'
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
    badges?: Array<{ code: string; earnedAt?: string | Date | null }>
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
            {/* Wrap in a native <button> so the row is keyboard-activatable
                (Enter / Space) and screen readers announce it as interactive.
                The shared <Card> primitive doesn't forward role / tabIndex
                / onKeyDown, so this is the cleanest a11y path. */}
            <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                aria-label={t('openAssetAria', { title })}
                className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-n-1"
            >
                <Card position={position} className={twMerge('cursor-pointer', className)}>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-3">
                                <Icon name="credit-card" size={18} />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold">{title}</p>
                                <p className="text-sm text-grey-1">{t(copyKeys.subtitle)}</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </button>

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
