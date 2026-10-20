'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { useStoryStep } from '@/components/Marketing/StarLp/useStoryStep'

const BEATS = 2

const phone = 'star-lp-phone border-4 border-border-default bg-background-default p-2 shadow-4'
const screen = 'grid min-h-56 justify-items-center gap-2 star-lp-phone-screen px-2 py-4 text-center md:min-h-64'

/**
 * One payment on two phones: your Paid screen, then the shop's lock screen
 * gets its "Pago recibido" a beat later. The shop notification is an
 * unbranded drawing, not Mercado Pago's UI. Plays once in view; a tap shows both.
 */
export function QrArgentinaTheirScreen() {
    const { ref, step, complete } = useStoryStep(BEATS, 900)
    const shown = (beat: number) => step > beat

    return (
        <div
            ref={ref}
            onClick={complete}
            role="img"
            aria-label="Two phones: yours shows Paid, ARS 3,600; the shop's lock screen shows Pago recibido"
            className="mx-auto grid w-full max-w-md grid-cols-2 gap-4 md:gap-8"
        >
            <div className={`${phone} -rotate-2`}>
                <div className={`${screen} content-center bg-background-badge-success`}>
                    <span
                        className="star-lp-beat grid size-12 place-items-center rounded-full border-2 border-border-default bg-green-500 text-foreground-inverse"
                        data-shown={shown(0)}
                        data-story-beat={0}
                    >
                        <Icon name="check" size={24} />
                    </span>
                    <span className="text-heading-s">Paid</span>
                    <span className="text-body-m-semibold">ARS 3,600</span>
                </div>
            </div>
            <div className={`${phone} rotate-2`}>
                <div className={`${screen} content-start bg-gray-950 text-foreground-inverse`}>
                    <span className="mt-2 text-heading-m">13:42</span>
                    <div
                        lang="es-AR"
                        className="star-lp-beat w-full rounded-card bg-background-default p-2 text-left text-body-xs text-foreground-primary"
                        data-shown={shown(1)}
                        data-story-beat={1}
                    >
                        <span className="block font-extrabold">Pago recibido</span>
                        Recibiste $3.600
                    </div>
                </div>
            </div>
        </div>
    )
}
