'use client'

/**
 * <BadgeSkipCelebration /> — one-time celebration moment when a user holds
 * a skip badge and lands on /card. Reuses the perk-claim shake intensity
 * (`getShakeClass`) for the gift-box → reveal animation, then surfaces the
 * shareable Twitter asset (D3) so the user can post about getting in.
 *
 * Once dismissed, stamps the seen marker (localStorage for M2; a
 * BE-persisted `cardWaitlistSkipCelebrationSeenAt` column is also wired up
 * — flip the constant below to switch over in Phase 5 cleanup).
 */

import { type FC, useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import ShareAssetD3 from '@/components/Card/share-asset/ShareAssetD3'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { getShakeClass } from '@/utils/perk.utils'
import { useHaptic } from 'use-haptic'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { TierLevel } from '@/components/Card/share-asset/shareAsset.types'

interface Props {
    /** Skip-badge code that unlocked card access (for the celebration headline). */
    badgeCode?: string
    /** Username for the share asset. Falls back to 'anon'. */
    username?: string
    /** User's badges, used by the share asset for the stamps. Shape mirrors
     *  ShareAssetBadge so the array flows straight through. */
    badges: Array<{ code: string; earnedAt?: string }>
    /** Stats for the share asset (joined date / spend / txns / invited count). */
    stats?: {
        joinedAt?: string | null
        totalMovedUsd?: number
        totalTxns?: number
        invitedCount?: number
    }
    /** Optional points/tier — falls back to 0/0 when omitted. */
    tier?: TierLevel
    pointsBalance?: number
    /** Called when the user dismisses the celebration — parent should mark
     *  it seen + advance to add-card. */
    onContinue: () => void
}

const SKIP_BADGE_HEADLINES: Record<string, string> = {
    OG_2025_10_12: 'OG access. You skipped the line.',
    DEVCONNECT_BA_2025: 'Devconnect crew. You skipped the line.',
    ARBIVERSE_DEVCONNECT_BA_2025: 'Arbiverse. You skipped the line.',
}

type Phase = 'pre-reveal' | 'shaking' | 'revealed'

const BadgeSkipCelebration: FC<Props> = ({
    badgeCode,
    username,
    badges,
    stats,
    tier,
    pointsBalance,
    onContinue,
}) => {
    const [phase, setPhase] = useState<Phase>('pre-reveal')
    const { triggerHaptic } = useHaptic()

    const headline =
        (badgeCode && SKIP_BADGE_HEADLINES[badgeCode]) || 'You skipped the line.'

    // Auto-reveal sequence: brief shake → confetti → asset on screen.
    useEffect(() => {
        if (phase !== 'pre-reveal') return
        posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_SKIPPED_BY_BADGE, { badge_code: badgeCode })
        const shakeAt = setTimeout(() => {
            setPhase('shaking')
            triggerHaptic()
        }, 250)
        const revealAt = setTimeout(() => {
            setPhase('revealed')
            shootDoubleStarConfetti()
            posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_VIEWED, { source: 'celebration' })
        }, 900)
        return () => {
            clearTimeout(shakeAt)
            clearTimeout(revealAt)
        }
    }, [phase, badgeCode, triggerHaptic])

    const handleShare = (): void => {
        posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, { source: 'celebration' })
        const text = encodeURIComponent("I got my Peanut card. shhhh — it's a closed beta.")
        const url = encodeURIComponent('https://peanut.me/shhhhh')
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Welcome in" />

            <div className="flex flex-col gap-2 text-center">
                <h1 className="text-3xl font-extrabold text-n-1">{headline}</h1>
                <p className="text-grey-1">
                    You hold a badge that skips the closed-beta queue. Card&apos;s yours.
                </p>
            </div>

            {/* Share asset container — pre-reveal shows nothing (or a gift box
                placeholder in a future polish), shaking applies the perk shake
                class, revealed shows the asset itself scaled to fit. */}
            <div
                className={`mx-auto w-full max-w-md ${getShakeClass(phase === 'shaking', 'strong')}`}
                style={{
                    transition: 'opacity 200ms ease-out',
                    opacity: phase === 'revealed' ? 1 : phase === 'shaking' ? 0.6 : 0.2,
                }}
            >
                {/* Native 1200×675; scale-to-fit the column. Wrapped in a div
                    that constrains height so the rotated asset doesn't
                    overflow into adjacent layout. */}
                <div
                    style={{
                        width: '100%',
                        aspectRatio: '1200 / 675',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            width: 1200,
                            height: 675,
                            transformOrigin: 'top left',
                            transform: 'scale(var(--scale))',
                            position: 'absolute',
                            inset: 0,
                            // CSS variable picked up by container query (closest
                            // ancestor width). 28rem = 448px max — scale ≈ 0.37.
                            // Use a JS-set value below as fallback for non-CQ.
                            ['--scale' as string]: 'min(1, calc(100cqw / 1200))',
                        }}
                    >
                        <ShareAssetD3
                            username={username ?? 'anon'}
                            badges={badges}
                            stats={stats}
                            tier={tier ?? 0}
                            pointsBalance={pointsBalance ?? 0}
                            cardLast4="0420"
                            animate={phase === 'revealed'}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-auto flex flex-col gap-3">
                <Button onClick={handleShare} variant="purple" shadowSize="4" className="w-full">
                    Share on X
                </Button>
                <Button onClick={onContinue} variant="stroke" className="w-full">
                    Continue to your card
                </Button>
            </div>
        </div>
    )
}

export default BadgeSkipCelebration
