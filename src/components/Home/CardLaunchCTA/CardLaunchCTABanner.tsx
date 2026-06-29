'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'
import { useHaptic } from 'use-haptic'

interface CardLaunchCTABannerProps {
    /** Tap-through: routes the user into the /card eligibility flow. */
    onTryDoor: () => void
    /** Close (X): permanently hides the banner. */
    onDismiss: () => void
}

/**
 * Fat home launch banner for the Peanut Card public launch.
 *
 * Presentational only — gating + persistence live in the `CardLaunchCTA`
 * container so this can be force-rendered in the /dev/home-ctas preview.
 *
 * Tone matches the /shhhhh teaser: pink, hard black border + shadow, extra-black
 * uppercase headline, provocative "maybe it's for you" framing. The whole card
 * is a tap target (parity with CarouselCTA); the X stops propagation.
 */
export default function CardLaunchCTABanner({ onTryDoor, onDismiss }: CardLaunchCTABannerProps) {
    const { triggerHaptic } = useHaptic()

    const handleTryDoor = () => {
        triggerHaptic()
        onTryDoor()
    }

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation()
        onDismiss()
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleTryDoor}
            className="relative mb-3 cursor-pointer overflow-hidden rounded-sm border-2 border-n-1 bg-primary-1 p-5 shadow-[4px_4px_0_#000]"
        >
            <button
                type="button"
                aria-label="Dismiss launch announcement"
                onClick={handleDismiss}
                className="absolute right-2.5 top-2.5 z-10 cursor-pointer p-1 text-n-1 outline-none"
            >
                <Icon name="cancel" size={16} />
            </button>

            <div className="relative z-[1] flex flex-col gap-3 pr-6">
                <h3 className="font-roboto-flex-extrabold text-4xl font-extraBlack leading-[1.02] text-n-1">shhh</h3>
                <p className="text-sm font-bold leading-snug text-n-1">Tap to find out if you&apos;re in</p>
                <Button
                    variant="dark"
                    shadowSize="4"
                    className="mt-1 w-full"
                    disableHaptics
                    onClick={(e) => {
                        e.stopPropagation()
                        handleTryDoor()
                    }}
                >
                    Try the door →
                </Button>
            </div>
        </div>
    )
}
