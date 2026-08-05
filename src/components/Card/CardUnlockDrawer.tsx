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

import { type FC, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { Checkbox } from '@/components/0_Bruddle/Checkbox'
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
    /** Full user-badges payload (with `earnedAt`) so the share asset can
     *  stamp every badge the user holds, not just the skip-the-line
     *  subset. Empty array → asset renders without stamps. */
    badges?: Array<{ code: string; earnedAt?: string | Date | null }>
}

export const CardUnlockDrawer: FC<Props> = ({ isOpen, onClose, entry, username, badges }) => {
    const t = useTranslations('card.unlockHistory')
    const captureRef = useRef<HTMLDivElement | null>(null)
    const [hideUsername, setHideUsername] = useState(false)
    // Gate the Share/Save buttons until the card face's async hand <canvas>
    // mounts — otherwise an early capture snapshots a blank card.
    const [assetReady, setAssetReady] = useState(false)

    useEffect(() => {
        if (!isOpen) return
        posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_VIEWED, { source: 'history-replay' })
    }, [isOpen])

    // Normalize earnedAt: ScaledShareAsset's `ShareAssetBadge` expects
    // `string | Date | undefined` — drop nulls.
    const assetBadges = (badges ?? [])
        .filter((b) => !!b.code)
        .map((b) => ({ code: b.code, earnedAt: b.earnedAt ?? undefined }))

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DrawerContent>
                {/* DrawerTitle has no built-in padding — must be wrapped in
                    DrawerHeader (mono Drawer pattern). */}
                <DrawerHeader>
                    <DrawerTitle className="text-2xl font-extrabold">
                        {entry.via === 'badge' ? t('drawerTitleBadge') : t('drawerTitleUnlocked')}
                    </DrawerTitle>
                </DrawerHeader>
                {/* Asset is capped at max-w-md on desktop so a 4:3 asset
                    doesn't blow up to 432px tall at the drawer's full xl
                    width and force a scrollbar. Centred so the buttons
                    below it span the same content column. */}
                <div className="flex flex-col gap-4 px-4 pb-6">
                    <div className="mx-auto w-full max-w-md">
                        <ScaledShareAsset
                            ref={captureRef}
                            username={username ?? 'anon'}
                            badges={assetBadges}
                            cardLast4="0420"
                            hideUsername={hideUsername}
                            animate={false}
                            onReady={() => setAssetReady(true)}
                        />
                    </div>
                    <div className="mx-auto flex w-full max-w-md flex-col gap-2">
                        {/* Anti-dox toggle — hides the peanut.me/<handle> pill on the asset */}
                        <Checkbox
                            className="self-center"
                            label={t('hideUsername')}
                            value={hideUsername}
                            onChange={(e) => setHideUsername(e.target.checked)}
                        />
                        <ShareAssetActions captureRef={captureRef} source="history-replay" ready={assetReady} />
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default CardUnlockDrawer
