'use client'

/**
 * <CardUnlockDrawer /> — re-opens the celebration share-asset moment
 * from the history feed.
 *
 * Renders the same ShareAssetD3 the user saw on the BadgeSkipCelebration
 * screen, deterministically seeded from username so it reproduces the
 * same visual layout they shared earlier. Plus the Twitter share button.
 */

import { type FC, useEffect, useRef, useState } from 'react'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { Button } from '@/components/0_Bruddle/Button'
import ShareAssetD3 from '@/components/Card/share-asset/ShareAssetD3'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { CardUnlockHistoryEntry } from './cardUnlock.types'

const SHARE_ASSET_NATIVE_W = 1200
const SHARE_ASSET_NATIVE_H = 675

interface Props {
    isOpen: boolean
    onClose: () => void
    entry: CardUnlockHistoryEntry
    username?: string
    skipBadges: string[]
}

export const CardUnlockDrawer: FC<Props> = ({ isOpen, onClose, entry, username, skipBadges }) => {
    const scaleHostRef = useRef<HTMLDivElement | null>(null)
    const [scale, setScale] = useState(0)

    // Re-scale the asset to fit the drawer's actual rendered width. Same
    // pattern as BadgeSkipCelebration — CSS container queries don't
    // propagate reliably through the Drawer wrapper.
    useEffect(() => {
        const host = scaleHostRef.current
        if (!host) return
        const measure = (): void => {
            const w = host.clientWidth
            if (w > 0) setScale(Math.min(1, w / SHARE_ASSET_NATIVE_W))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(host)
        return () => ro.disconnect()
    }, [isOpen])

    useEffect(() => {
        if (!isOpen) return
        posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_VIEWED, { source: 'history-replay' })
    }, [isOpen])

    const handleShare = (): void => {
        posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, { source: 'history-replay' })
        const text = encodeURIComponent("I got my Peanut card. shhhh — it's a closed beta.")
        const url = encodeURIComponent('https://peanut.me/shhhhh')
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
    }

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DrawerContent>
                <DrawerTitle>
                    {entry.via === 'badge' ? 'You skipped the line' : 'Card access unlocked'}
                </DrawerTitle>
                <div className="flex flex-col gap-4 p-4">
                    <div
                        ref={scaleHostRef}
                        style={{
                            width: '100%',
                            height: scale > 0 ? SHARE_ASSET_NATIVE_H * scale : 'auto',
                            aspectRatio:
                                scale > 0 ? undefined : `${SHARE_ASSET_NATIVE_W} / ${SHARE_ASSET_NATIVE_H}`,
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {scale > 0 && (
                            <div
                                style={{
                                    width: SHARE_ASSET_NATIVE_W,
                                    height: SHARE_ASSET_NATIVE_H,
                                    transformOrigin: 'top left',
                                    transform: `scale(${scale})`,
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                }}
                            >
                                <ShareAssetD3
                                    username={username ?? 'anon'}
                                    badges={skipBadges.map((code) => ({ code }))}
                                    cardLast4="0420"
                                    animate={false}
                                />
                            </div>
                        )}
                    </div>
                    <Button onClick={handleShare} variant="purple" shadowSize="4" className="w-full">
                        Share on X
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default CardUnlockDrawer
