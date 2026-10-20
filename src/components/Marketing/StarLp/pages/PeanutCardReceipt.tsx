'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'
import { useStoryStep } from '@/components/Marketing/StarLp/useStoryStep'

// Beats: checkout, approved, Activity row, receipt prints, fee circled.
const BEATS = 5

// Torn paper edge: 18 teeth stretched to the receipt's width, stroked like its 2px sides.
const TEETH = 18
const TOOTH_PATH = Array.from({ length: TEETH }, (_, i) => `L${i * 16 + 8} 9 L${(i + 1) * 16} 0`).join(' ')

const miniCard = <span aria-hidden className="h-4 w-6 shrink-0 rounded-sm border-2 border-border-default bg-pink-500" />

// A hand-drawn pink ring around "Peanut fee" and "$0.00"; drawn last.
const circled = (shown: boolean) => (
    <span
        aria-hidden
        className="star-lp-beat pointer-events-none absolute -inset-x-2 -inset-y-1 -rotate-3 rounded-full border-[3px] border-pink-700"
        data-shown={shown}
        data-story-beat={4}
    />
)

/**
 * The card fold's drawing: a $14.99 subscription is approved on card •••• 0420,
 * lands in Activity, and the receipt prints with the Peanut fee circled.
 * Plays once in view; a tap shows it all.
 */
export function PeanutCardReceipt() {
    const { ref, step, complete } = useStoryStep(BEATS, 600)
    const shown = (beat: number) => step > beat

    return (
        <div
            ref={ref}
            onClick={complete}
            role="img"
            aria-label="Checkout: a $14.99 subscription on card ending 0420 is approved, shows in Activity, and the receipt shows a Peanut fee of $0.00"
            className="mx-auto w-full max-w-sm md:max-w-[26rem]"
        >
            <div className="relative h-60">
                <div
                    className="star-lp-beat absolute top-0 left-0 z-20 grid w-[64%] -rotate-3 gap-2 rounded-card border-2 border-border-default bg-background-default p-3 shadow-4"
                    data-shown={shown(0)}
                    data-story-beat={0}
                >
                    <div className="flex justify-between text-label-l">
                        <span>Subscription</span>
                        <span>$14.99</span>
                    </div>
                    <div className="flex items-center gap-2 rounded border-2 border-border-disabled px-2 py-2 text-label-m">
                        {miniCard}
                        •••• 0420
                    </div>
                    <div
                        className="star-lp-beat flex items-center justify-center gap-1 rounded-full border-2 border-border-default bg-background-badge-success py-2 text-label-l"
                        data-shown={shown(1)}
                        data-story-beat={1}
                    >
                        <Icon name="check" size={16} />
                        Approved
                    </div>
                </div>
                <div
                    className="star-lp-beat absolute top-[7.5rem] right-0 z-10 w-[78%] xs:w-[62%]"
                    data-shown={shown(2)}
                    data-story-beat={2}
                >
                    <PhoneFrame tilt={3} screen="white">
                        <div className="text-center text-label-l">Activity</div>
                        <div className="flex items-center justify-between gap-2 border-t-2 border-border-disabled pt-2 text-label-m">
                            <span className="flex items-center gap-2">
                                {miniCard}
                                Subscription
                            </span>
                            <span className="whitespace-nowrap">−$14.99</span>
                        </div>
                    </PhoneFrame>
                </div>
            </div>

            {/* The receipt feeds out from under its top edge, like a till printing. */}
            <div className="mx-auto mt-8 w-[78%] rotate-[1.5deg] overflow-hidden pb-1">
                {/* Hidden only while data-shown is false: the server HTML, no-JS and
                    reduced-motion visitors get the story complete (useStoryStep). */}
                <div
                    data-shown={shown(3)}
                    data-story-beat={3}
                    className="transition-transform duration-slow ease-out data-[shown=false]:-translate-y-[110%] motion-reduce:translate-y-0! motion-reduce:transition-none"
                >
                    <div className="border-x-2 border-t-2 border-border-default bg-background-surface-attention px-4 pt-4 pb-4 font-mono text-body-s">
                        <div className="flex justify-between">
                            <span>Subscription</span>
                            <span>$14.99</span>
                        </div>
                        <div className="mt-2 flex justify-between">
                            <span className="relative">
                                Peanut fee
                                {circled(shown(4))}
                            </span>
                            <span className="relative">
                                $0.00
                                {circled(shown(4))}
                            </span>
                        </div>
                    </div>
                    <svg
                        aria-hidden
                        viewBox={`0 0 ${TEETH * 16} 10`}
                        preserveAspectRatio="none"
                        className="block h-2.5 w-full -translate-y-px overflow-visible"
                    >
                        <path d={`M0 0 ${TOOTH_PATH} Z`} className="fill-background-surface-attention" />
                        <path
                            d={`M0 0 ${TOOTH_PATH}`}
                            vectorEffect="non-scaling-stroke"
                            className="fill-none stroke-border-default stroke-2"
                            strokeLinejoin="miter"
                        />
                    </svg>
                </div>
            </div>
        </div>
    )
}
