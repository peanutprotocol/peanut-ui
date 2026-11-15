'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

/**
 * The hold-to-claim gesture's button: the fill grows while it is held (`usePerkHoldToClaim`), and the
 * label turns white under the fill. It stands alone while a reward waits, so no other CTA competes.
 */
export function HoldToClaimButton({
    holdProgress,
    startHold,
    cancelHold,
}: {
    holdProgress: number
    startHold: () => void
    cancelHold: () => void
}) {
    const t = useAppTranslations('qrPay')
    const label = t('success.claimReward')
    return (
        <Button
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    startHold()
                }
            }}
            onKeyUp={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    cancelHold()
                }
            }}
            // a long press must not open the context menu
            onContextMenu={(e) => e.preventDefault()}
            shadowSize="4"
            className="relative touch-manipulation overflow-hidden select-none"
            style={{
                WebkitTouchCallout: 'none',
                WebkitTapHighlightColor: 'transparent',
            }}
        >
            {/* progress fill from left to right */}
            <div
                className="absolute inset-0 bg-black transition-all duration-instant"
                style={{ width: `${holdProgress}%`, left: 0 }}
            />
            <span className="relative z-10">{label}</span>
            <span
                className="absolute inset-0 z-20 flex items-center justify-center text-white transition-all duration-instant"
                style={{ clipPath: `inset(0 ${100 - holdProgress}% 0 0)` }}
            >
                {label}
            </span>
        </Button>
    )
}
