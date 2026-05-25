'use client'

/**
 * <CardUnlockDrawer /> — re-opens the celebration share-asset moment
 * from the history feed.
 *
 * Renders the same ShareAssetD3 the user saw on the BadgeSkipCelebration
 * screen, deterministically seeded from username so it reproduces the
 * same visual layout they shared earlier. Plus the Twitter share button.
 */

import { type FC, useEffect } from 'react'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { Button } from '@/components/0_Bruddle/Button'
import { ScaledShareAsset } from '@/components/Card/share-asset/ScaledShareAsset'
import { shareCardOnTwitter } from '@/components/Card/share-asset/share.utils'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { CardUnlockHistoryEntry } from './cardUnlock.types'

interface Props {
    isOpen: boolean
    onClose: () => void
    entry: CardUnlockHistoryEntry
    username?: string
    skipBadges: string[]
}

export const CardUnlockDrawer: FC<Props> = ({ isOpen, onClose, entry, username, skipBadges }) => {
    useEffect(() => {
        if (!isOpen) return
        posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_VIEWED, { source: 'history-replay' })
    }, [isOpen])

    const handleShare = (): void => {
        posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, { source: 'history-replay' })
        shareCardOnTwitter()
    }

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DrawerContent>
                <DrawerTitle>
                    {entry.via === 'badge' ? 'You skipped the line' : 'Card access unlocked'}
                </DrawerTitle>
                <div className="flex flex-col gap-4 p-4">
                    <ScaledShareAsset
                        username={username ?? 'anon'}
                        badges={skipBadges.map((code) => ({ code }))}
                        cardLast4="0420"
                        animate={false}
                    />
                    <Button onClick={handleShare} variant="purple" shadowSize="4" className="w-full">
                        Share on X
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default CardUnlockDrawer
