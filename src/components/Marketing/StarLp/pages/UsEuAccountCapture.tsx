import Image from 'next/image'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { twMerge } from '@/utils/tw'
import type { UsEuAccountCaptureProps } from './usEuAccounts.types'

/** The press, shared by the card and its sign so they sink together. */
const PRESS =
    'group-active:translate-x-1 group-active:translate-y-1 group-active:shadow-none motion-safe:transition-[translate,box-shadow] motion-safe:duration-instant'

/** Centred on the corner, tilted away from the card. The top corners sit under the Knerd (artTuck deep),
    the inner ones under the other card, so each capture gets the outer corner that stays clear. */
const BADGE_CORNER_CLASS: Record<UsEuAccountCaptureProps['badgeCorner'], string> = {
    'bottom-left': '-bottom-3 -left-3 -rotate-6',
    // right-0 below md: the EUR card already hangs past the gutter on phones
    'top-right': '-top-3 right-0 rotate-6 md:-right-3',
}

/**
 * A real bank-details screen as a sticker that drops in, with its currency sign
 * stuck on one corner. It sits in a link, so a press is the DS press: a 4px
 * drop onto its hard shadow, which goes. The press is the link's `group-active`
 * state, not a framer `whileTap`, which would make this box its own keyboard
 * stop inside the decorative hero art. Hover adds no motion (design.md §
 * marketing components).
 */
export function UsEuAccountCapture({ src, tilt, delay, badge, badgeCorner, className }: UsEuAccountCaptureProps) {
    return (
        <DropIn fromTilt={tilt * 4} tilt={tilt} delay={delay} className={className}>
            <div className="relative">
                <div
                    className={twMerge(
                        'overflow-hidden rounded-card border-2 border-border-default bg-background-page shadow-4',
                        PRESS
                    )}
                >
                    <Image
                        src={src}
                        alt=""
                        sizes="(min-width: 1024px) 480px, (min-width: 768px) 352px, 90vw"
                        className="h-auto w-full"
                        priority
                    />
                </div>
                <span
                    aria-hidden
                    className={twMerge(
                        'font-roboto-flex-extrabold shadow-2 absolute grid size-12 place-items-center rounded-full border-2 border-border-default bg-background-accent-yellow text-heading-s',
                        BADGE_CORNER_CLASS[badgeCorner],
                        PRESS
                    )}
                >
                    {badge}
                </span>
            </div>
        </DropIn>
    )
}
