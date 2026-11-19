'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import star from '@/assets/illustrations/star.svg'
import { PEANUT_SITTING } from '@/assets/mascot'
import { SHARP, SPRING } from './timeline'

const UP = 'translate(0, 0)'
const DOWN = 'translate(4px, 4px)'
const CHIP_TILT = 'rotate(-3deg)'
// lavender, yellow, pink — dealt back to front. The cards shrink a little as
// they tilt, so their corners stay inside the stage on a narrow phone.
const FAN = [
    ['bg-blue-300', 'translate(-20px, -150px) rotate(-11deg) scale(0.88)'],
    ['bg-background-accent-yellow', 'translate(18px, -104px) rotate(9deg) scale(0.88)'],
    ['bg-background-brand', 'translate(-8px, -54px) rotate(-5deg) scale(0.88)'],
] as const

/**
 * Receipt card fan. The receipt presses once, three palette cards deal out
 * from behind it and tuck back, and a yellow "Sent" chip stays on its corner.
 * Showcase only: no app screen plays this.
 */
export function ReceiptCardFan({ reduced }: { reduced: boolean }) {
    const face = useRef<HTMLDivElement>(null)
    const mascot = useRef<HTMLImageElement>(null)
    const chip = useRef<HTMLDivElement>(null)
    const fan = useRef<(HTMLDivElement | null)[]>([])

    useEffect(() => {
        const animations: Animation[] = []
        const play = (element: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
            if (element) animations.push(element.animate(keyframes, options))
        }
        if (reduced) {
            play(
                chip.current,
                [{ transform: `scale(0) ${CHIP_TILT}`, easing: 'steps(1, end)' }, { transform: CHIP_TILT }],
                {
                    duration: 200,
                    fill: 'forwards',
                }
            )
            return () => animations.forEach((animation) => animation.cancel())
        }
        FAN.forEach(([, dealt], index) => {
            const card = fan.current[index]
            play(card, [{ transform: UP }, { transform: dealt }], {
                duration: 500,
                delay: 160 + (2 - index) * 60,
                easing: SPRING,
                fill: 'forwards',
            })
            play(card, [{ transform: dealt }, { transform: UP }], {
                duration: 200,
                delay: 1300 + index * 60,
                easing: SHARP,
                fill: 'forwards',
            })
        })
        // press, release
        play(face.current, [{ transform: UP }, { transform: DOWN }], { duration: 100, easing: SHARP, fill: 'forwards' })
        play(face.current, [{ transform: DOWN }, { transform: UP }], {
            duration: 300,
            delay: 160,
            easing: SPRING,
            fill: 'forwards',
        })
        play(mascot.current, [{ transform: UP }, { transform: DOWN }], {
            duration: 100,
            easing: SHARP,
            fill: 'forwards',
        })
        play(
            mascot.current,
            [
                { transform: DOWN },
                { transform: 'translateY(-10px) rotate(-6deg)', offset: 0.4 },
                { transform: 'rotate(2deg)', offset: 0.7 },
                { transform: UP },
            ],
            { duration: 500, delay: 160, easing: SPRING, fill: 'forwards' }
        )
        // the chip pops and stays
        play(
            chip.current,
            [
                { transform: `scale(0) ${CHIP_TILT}` },
                { transform: `scale(1.25) ${CHIP_TILT}`, offset: 0.6 },
                { transform: `scale(1) ${CHIP_TILT}` },
            ],
            { duration: 300, delay: 620, easing: SPRING, fill: 'forwards' }
        )
        // landing bump once the deck is back
        const bump = [{ transform: UP }, { transform: DOWN, offset: 0.3 }, { transform: UP }]
        play(face.current, bump, { duration: 400, delay: 1480, easing: SPRING })
        play(mascot.current, bump, { duration: 400, delay: 1480, easing: SPRING })
        return () => animations.forEach((animation) => animation.cancel())
    }, [reduced])

    return (
        <>
            <div className="absolute top-[190px] left-0 h-[110px] w-[316px]">
                <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-sm bg-black" />
                {FAN.map(([fill], index) => (
                    <div
                        key={fill}
                        ref={(element) => {
                            fan.current[index] = element
                        }}
                        className={`absolute inset-0 origin-bottom rounded-sm border-2 border-border-default ${fill}`}
                    />
                ))}
                <div
                    ref={face}
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-sm border-2 border-border-default bg-background-default"
                >
                    <p className="text-body-m">You sent Maria</p>
                    <p className="text-heading-l">25 EUR</p>
                </div>
                <div ref={chip} className="absolute -top-5 right-2 h-10 w-28 [transform:scale(0)]">
                    <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-full bg-black" />
                    <div className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-full border-2 border-border-default bg-background-accent-yellow text-heading-card">
                        <Image src={star} alt="" className="h-6 w-auto" />
                        Sent
                    </div>
                </div>
            </div>
            <Image
                ref={mascot}
                src={PEANUT_SITTING}
                alt=""
                className="absolute top-[65px] left-[103px] w-[110px] origin-[50%_80%]"
            />
        </>
    )
}
