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
    skipBadges?: string[]
}

const VIA_COPY: Record<CardUnlockHistoryEntry['via'], { title: string; subtitle: string }> = {
    badge: {
        title: 'You skipped the line',
        subtitle: 'Tap to re-open your share asset',
    },
    admin: {
        title: 'Card access unlocked',
        subtitle: 'Welcome in. Tap to share.',
    },
    'public-launch': {
        title: 'Card access unlocked',
        subtitle: 'Open to everyone now. Tap to share.',
    },
}

const CardUnlockHistoryItem: FC<Props> = ({
    entry,
    position = 'single',
    className,
    username,
    skipBadges,
}) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const copy = VIA_COPY[entry.via]

    return (
        <>
            <Card
                position={position}
                onClick={() => setIsDrawerOpen(true)}
                className={twMerge('cursor-pointer', className)}
            >
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-3">
                            <Icon name="credit-card" size={18} />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold">{copy.title}</p>
                            <p className="text-sm text-grey-1">{copy.subtitle}</p>
                        </div>
                    </div>
                </div>
            </Card>

            {isDrawerOpen && (
                <CardUnlockDrawer
                    isOpen={isDrawerOpen}
                    onClose={() => setIsDrawerOpen(false)}
                    entry={entry}
                    username={username}
                    skipBadges={skipBadges ?? []}
                />
            )}
        </>
    )
}

export default CardUnlockHistoryItem
