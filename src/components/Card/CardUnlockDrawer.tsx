'use client'

/**
 * <CardUnlockDrawer /> — re-opens the celebration share-asset moment
 * from the history feed.
 *
 * Renders the same ShareAssetD3 the user saw on the BadgeSkipCelebration
 * screen, deterministically seeded from username so it reproduces the
 * same visual layout they shared earlier. Plus the shared
 * <ShareAssetActions /> (Share + Save image).
 */

import { type FC, useEffect, useRef } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { ScaledShareAsset } from '@/components/Card/share-asset/ScaledShareAsset'
import { ShareAssetActions } from '@/components/Card/share-asset/ShareAssetActions'
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
    const captureRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!isOpen) return
        posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_VIEWED, { source: 'history-replay' })
    }, [isOpen])

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DrawerContent>
                {/* DrawerTitle has no built-in padding — must be wrapped in
                    DrawerHeader (mono Drawer pattern). Without this the
                    title hugs the drawer-pull handle with no top/horizontal
                    breathing room. */}
                <DrawerHeader>
                    <DrawerTitle className="text-2xl font-extrabold">
                        {entry.via === 'badge' ? 'You skipped the line' : 'Card access unlocked'}
                    </DrawerTitle>
                </DrawerHeader>
                <div className="flex flex-col gap-4 px-4 pb-6">
                    <ScaledShareAsset
                        ref={captureRef}
                        username={username ?? 'anon'}
                        badges={skipBadges.map((code) => ({ code }))}
                        cardLast4="0420"
                        animate={false}
                    />
                    <ShareAssetActions
                        captureRef={captureRef}
                        source="history-replay"
                        shareText="I got my Peanut card. shhhh."
                    />
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default CardUnlockDrawer
