'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'
import { useStoryStep } from '@/components/Marketing/StarLp/useStoryStep'
import { QR_AR_PAID_EVENT, QR_AR_PRICE_ARS } from './qrArgentina.consts'

const BEATS = 2
const STEP_MS = 900
// After Pay, the page scrolls here first; the replay starts once it has landed.
const REPLAY_LEAD_MS = 600

const PRICE = `ARS ${QR_AR_PRICE_ARS.toLocaleString('en-US')}`
// The shop's phone is in Spanish: "$3.600".
const PRICE_AR = `$${QR_AR_PRICE_ARS.toLocaleString('es-AR')}`

const phone = 'star-lp-phone border-4 border-border-default bg-background-default p-2 shadow-4'
const screen = 'grid min-h-56 justify-items-center gap-2 star-lp-phone-screen px-2 py-4 text-center md:min-h-64'

/**
 * One payment on two phones: your Paid screen, then the shop's lock screen
 * gets its "Pago recibido" a beat later. The shop notification is an
 * unbranded drawing, not Mercado Pago's UI. Plays once in view; a tap shows
 * both. The Review's Pay button replays it. The push drops from the top
 * like a lock-screen notification (.qr-ar-push, QrArgentinaMotionStyle).
 */
export function QrArgentinaTheirScreen() {
    const { ref, step, complete } = useStoryStep(BEATS, STEP_MS)
    const [replay, setReplay] = useState<number | null>(null)

    useEffect(() => {
        let timers: number[] = []
        const onPaid = () => {
            timers.forEach(window.clearTimeout)
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
            setReplay(0)
            timers = [1, 2].map((beat) =>
                window.setTimeout(() => setReplay(beat), REPLAY_LEAD_MS + (beat - 1) * STEP_MS)
            )
        }
        window.addEventListener(QR_AR_PAID_EVENT, onPaid)
        return () => {
            window.removeEventListener(QR_AR_PAID_EVENT, onPaid)
            timers.forEach(window.clearTimeout)
        }
    }, [])

    const shown = (beat: number) => (replay === null ? step : replay) > beat
    const showAll = () => {
        setReplay(null)
        complete()
    }

    return (
        <div
            ref={ref}
            onClick={showAll}
            role="img"
            aria-label={`Two phones: yours shows Paid, ${PRICE}; the shop's lock screen shows Pago recibido`}
            className="mx-auto grid w-full max-w-md grid-cols-2 gap-4 md:gap-8 md:pr-3"
        >
            <div className={`${phone} -rotate-2`}>
                <div className={`${screen} content-center bg-background-badge-success`}>
                    {/* one beat: the tick pops, then Paid and the amount rise with it */}
                    <div
                        className="qr-ar-paid grid justify-items-center gap-2"
                        data-shown={shown(0)}
                        data-story-beat={0}
                    >
                        <span className="qr-ar-tick grid size-12 place-items-center rounded-full border-2 border-border-default bg-green-500 text-foreground-inverse">
                            <Icon name="check" size={24} />
                        </span>
                        <span className="qr-ar-paid-text text-heading-s">Paid</span>
                        <span className="qr-ar-paid-text text-body-m-semibold">{PRICE}</span>
                    </div>
                </div>
            </div>
            {/* the shop's phone buzzes as the push lands */}
            <div className={`${phone} qr-ar-buzz rotate-2`} data-buzz={shown(1)}>
                <div className={`${screen} content-start overflow-hidden bg-gray-950 text-foreground-inverse`}>
                    <span className="mt-2 text-heading-m">13:42</span>
                    <div
                        lang="es-AR"
                        className="qr-ar-push w-full rounded-card bg-background-default p-2 text-left text-body-xs text-foreground-primary"
                        data-shown={shown(1)}
                        data-story-beat={1}
                    >
                        <span className="block font-extrabold">Pago recibido</span>
                        Recibiste {PRICE_AR}
                    </div>
                </div>
            </div>
        </div>
    )
}
