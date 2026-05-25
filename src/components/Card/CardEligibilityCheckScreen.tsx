'use client'

/**
 * <CardEligibilityCheckScreen /> — the "See if you qualify" moment.
 *
 * Entry point for the badge-gated flow: pixelated card on top, hero CTA
 * with the same press-and-hold mechanic as PerkClaimModal (shared shake
 * intensity + haptics). On hold-complete, the parent decides what to
 * show next:
 *   - has a skip badge → BadgeSkipCelebration (share-asset reveal)
 *   - no skip badge    → CardWaitlistScreen (waitlist-joined framing)
 *
 * Press-and-hold is what gives the moment its weight — the user
 * physically engages with the door before it opens.
 */

import { type FC, useEffect } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import { PixelatedCardFace } from '@/components/Card/share-asset/PixelatedCardFace'
import { useHoldToClaim } from '@/hooks/useHoldToClaim'
import { getShakeClass } from '@/utils/perk.utils'
import { useHaptic } from 'use-haptic'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

interface Props {
    onComplete: () => void
    onPrev?: () => void
    /** Reflect-back string for the verifying state (e.g. user.username). */
    username?: string
}

const CardEligibilityCheckScreen: FC<Props> = ({ onComplete, onPrev, username }) => {
    const { triggerHaptic } = useHaptic()
    const { holdProgress, isShaking, shakeIntensity, buttonProps } = useHoldToClaim({
        onComplete: () => {
            triggerHaptic()
            posthog.capture(ANALYTICS_EVENTS.CARD_ELIGIBILITY_CHECK_COMPLETED)
            onComplete()
        },
        enableTapMode: true,
        tapProgress: 12,
        holdProgressPerSec: 80,
        decayRate: 8,
    })

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_ELIGIBILITY_CHECK_VIEWED)
    }, [])

    const shakeClass = getShakeClass(isShaking, shakeIntensity)

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="The door" onPrev={onPrev} />

            <div className={`mx-auto ${shakeClass}`} style={{ transformOrigin: 'center' }}>
                <PixelatedCardFace last4="????" blurAll />
            </div>

            <div className="flex flex-col gap-2 text-center">
                <h1 className="text-2xl font-extrabold text-n-1">
                    {username ? `Let's see, @${username}…` : "Let's see if you qualify"}
                </h1>
                <p className="text-grey-1">
                    Press and hold to check your badges. If you&apos;ve got the right one, you skip
                    the line entirely.
                </p>
            </div>

            <div className="mt-auto flex flex-col gap-3">
                <button
                    type="button"
                    {...buttonProps}
                    className={`relative w-full overflow-hidden rounded-sm border-2 border-n-1 bg-primary-1 px-4 py-4 font-extrabold uppercase text-n-1 shadow-[4px_4px_0_#000] transition-shadow ${buttonProps.className ?? ''}`}
                >
                    {/* Fill bar — primary-1 to white. Width tracks holdProgress 0-100. */}
                    <div
                        className="pointer-events-none absolute inset-y-0 left-0 bg-white/30 transition-[width] duration-75"
                        style={{ width: `${holdProgress}%` }}
                    />
                    <span className="relative">
                        {holdProgress >= 99
                            ? 'Checking…'
                            : holdProgress > 0
                              ? `Holding… ${Math.floor(holdProgress)}%`
                              : 'See if you qualify'}
                    </span>
                </button>
                <p className="text-center text-xs text-grey-1">
                    Hold the button. We&apos;re looking you up.
                </p>
            </div>
        </div>
    )
}

export default CardEligibilityCheckScreen
