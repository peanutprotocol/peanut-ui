'use client'

import Image from 'next/image'
import { Icon } from '@/components/Global/Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'
import { Sparkle } from '@/assets/illustrations'
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
            className="relative cursor-pointer overflow-hidden rounded-sm border-2 border-n-1 bg-primary-1 p-5 shadow-[4px_4px_0_#000]"
        >
            <button
                type="button"
                aria-label="Dismiss launch announcement"
                onClick={handleDismiss}
                className="absolute right-2.5 top-2.5 z-10 cursor-pointer p-1 text-n-1 outline-none"
            >
                <Icon name="cancel" size={16} />
            </button>

            <Image
                src={Sparkle}
                alt=""
                aria-hidden
                width={56}
                height={56}
                className="pointer-events-none absolute -right-3 -top-3 w-12 select-none md:w-14"
            />

            <div className="relative z-[1] flex flex-col gap-3 pr-6">
                <span className="font-roboto-flex-extrabold text-[11px] font-extraBlack uppercase tracking-[0.22em] text-n-1 opacity-60">
                    shhhhh · it&apos;s out
                </span>
                <h3 className="font-roboto-flex-extrabold text-2xl font-extraBlack uppercase leading-[1.02] text-n-1">
                    The card is out.
                    <br />
                    For you? Maybe.
                </h3>
                <p className="text-sm font-bold leading-snug text-n-1">
                    We opened the door to everyone. Tap to find out if you&apos;re in.
                </p>
                <Button
                    variant="dark"
                    shadowSize="4"
                    className="mt-1 w-full"
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
