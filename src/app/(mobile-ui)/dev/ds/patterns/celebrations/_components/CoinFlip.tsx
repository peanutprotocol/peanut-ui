'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Card from '@/components/Global/Card'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import coinEur from '@/assets/onboarding/coin-eur-face.svg'
import coinUsd from '@/assets/onboarding/coin-usd-face.svg'
import { HOLD, SHARP, SPRING, timeline } from './timeline'

const TOTAL = 2000
// from the card's empty right side down into the points row
const DROP = 'translate(14px, 109px)'
const BOUNCE = 'translate(14px, 99px)'
const FLIP = 'steps(3, end)'

/**
 * One coin flip. A dollar coin pops next to the amount, flips to the euro coin
 * and back in chunky steps, drops into the points row, bounces once and
 * leaves. Showcase only: no app screen plays this.
 */
export function CoinFlip({ reduced }: { reduced: boolean }) {
    const coin = useRef<HTMLDivElement>(null)
    const usd = useRef<HTMLImageElement>(null)
    const eur = useRef<HTMLImageElement>(null)
    const tick = useRef<HTMLImageElement>(null)

    useEffect(() => {
        const animations: Animation[] = []
        const run = (element: Element | null, total: number, steps: Parameters<typeof timeline>[2]) => {
            if (element) animations.push(timeline(element, total, steps))
        }
        if (reduced) {
            run(coin.current, 1200, [
                [0, `${DROP} scale(0)`, HOLD],
                [100, `${DROP} scale(0.42)`, HOLD],
                [1000, `${DROP} scale(0)`],
            ])
            return () => animations.forEach((animation) => animation.cancel())
        }
        run(coin.current, TOTAL, [
            [0, 'translate(0px, 0px) scale(0) rotate(12deg)', SPRING],
            [300, 'translate(0px, 0px) scale(1) rotate(-6deg)', HOLD],
            [1100, 'translate(0px, 0px) scale(1) rotate(-6deg)', SHARP],
            [1400, `${DROP} scale(0.42) rotate(0deg)`, SPRING],
            [1500, `${BOUNCE} scale(0.42) rotate(0deg)`, SHARP],
            [1600, `${DROP} scale(0.42) rotate(0deg)`, HOLD],
            [1800, `${DROP} scale(0.42) rotate(0deg)`, SHARP],
            [2000, `${DROP} scale(0) rotate(0deg)`],
        ])
        run(usd.current, TOTAL, [
            [400, 'scaleX(1)', FLIP],
            [500, 'scaleX(0)', HOLD],
            [900, 'scaleX(0)', FLIP],
            [1000, 'scaleX(1)'],
        ])
        run(eur.current, TOTAL, [
            [500, 'scaleX(0)', FLIP],
            [600, 'scaleX(1)', HOLD],
            [800, 'scaleX(1)', FLIP],
            [900, 'scaleX(0)'],
        ])
        // landing tick beside the coin: two held poses, hard on and off
        run(tick.current, TOTAL, [
            [1400, 'scale(0)', HOLD],
            [1420, 'scale(1) rotate(0deg)', HOLD],
            [1520, 'scale(1.15) rotate(8deg)', HOLD],
            [1620, 'scale(1) rotate(0deg)', HOLD],
            [1720, 'scale(0)'],
        ])
        return () => animations.forEach((animation) => animation.cancel())
    }, [reduced])

    return (
        <>
            <div className="absolute top-5 left-0 flex h-[130px] w-[316px] flex-col justify-center rounded-sm border-2 border-border-default bg-background-default px-5 shadow-4">
                <p className="text-body-m">You paid</p>
                <p className="text-heading-l">25 EUR</p>
            </div>
            <Card className="absolute top-[170px] left-0 flex h-12 w-[316px] items-center gap-2 px-4 py-0">
                <Image src={star} alt="" className="h-5 w-auto" />
                <p className="text-body-m">You earned 25 points</p>
            </Card>
            <div
                ref={coin}
                className="absolute top-[35px] left-[200px] size-[100px] [transform:scale(0)] drop-shadow-[4px_4px_0_var(--color-border-default)]"
            >
                <Image ref={usd} src={coinUsd} alt="" className="absolute inset-0 size-full" />
                <Image ref={eur} src={coinEur} alt="" className="absolute inset-0 size-full [transform:scaleX(0)]" />
            </div>
            <Image
                ref={tick}
                src={sparkle}
                alt=""
                className="absolute top-[170px] left-[290px] w-[26px] [transform:scale(0)]"
            />
        </>
    )
}
