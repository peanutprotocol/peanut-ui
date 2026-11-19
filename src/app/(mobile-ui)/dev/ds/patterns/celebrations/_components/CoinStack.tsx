'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import stackCoin from '@/assets/illustrations/stack-coin.svg'
import coinEur from '@/assets/onboarding/coin-eur-face.svg'
import coinUsd from '@/assets/onboarding/coin-usd-face.svg'
import { HOLD, SHARP, SPRING, timeline } from './timeline'

const TOTAL = 2450
const COINS = 8
const SIZE = 56
const GAP = 36
const FIRST_X = 4
// coins rest on the card's top edge
const REST_TOP = 68
// FIRST_X + index * GAP, as classes: an inline style is not allowed here
const COIN_LEFT = [
    'left-[4px]',
    'left-[40px]',
    'left-[76px]',
    'left-[112px]',
    'left-[148px]',
    'left-[184px]',
    'left-[220px]',
    'left-[256px]',
]
// they hop out of the middle of the card
const ORIGIN = { x: 160, y: 175 }
// and gather where the glove stamps
const GATHER_X = 238

/**
 * Coins land, get stacked. Eight coin faces hop out of the pay card, land in a
 * row on its top edge, then snap into the glove holding a coin stack, which
 * stamps and leaves. Showcase only: no app screen plays this.
 */
export function CoinStack({ reduced }: { reduced: boolean }) {
    const wraps = useRef<(HTMLDivElement | null)[]>([])
    const coins = useRef<(HTMLImageElement | null)[]>([])
    const hand = useRef<HTMLImageElement>(null)

    useEffect(() => {
        const animations: Animation[] = []
        if (reduced) {
            if (hand.current) {
                animations.push(
                    timeline(hand.current, 1200, [
                        [0, 'scale(0) rotate(-3deg)', HOLD],
                        [100, 'scale(1) rotate(-3deg)', HOLD],
                        [1000, 'scale(0) rotate(-3deg)'],
                    ])
                )
            }
            return () => animations.forEach((animation) => animation.cancel())
        }
        for (let index = 0; index < COINS; index++) {
            const wrap = wraps.current[index]
            const coin = coins.current[index]
            if (!wrap || !coin) continue
            const x = FIRST_X + index * GAP
            const start = index * 80
            const fromX = ORIGIN.x - (x + SIZE / 2)
            const fromY = ORIGIN.y - (REST_TOP + SIZE / 2)
            const tilt = index % 2 ? '9deg' : '-9deg'
            const gather = GATHER_X - x
            // the wrapper travels sideways, then gathers to the stack
            animations.push(
                timeline(wrap, TOTAL, [
                    [start, `translateX(${fromX}px) scale(0)`, SPRING],
                    [start + 200, `translateX(${fromX * 0.7}px) scale(1)`, SHARP],
                    [start + 500, 'translateX(0px) scale(1)', HOLD],
                    [1400 + (COINS - 1 - index) * 20, 'translateX(0px) scale(1)', SHARP],
                    [1700, `translateX(${gather}px) scale(1)`, HOLD],
                    [1720, `translateX(${gather}px) scale(0)`],
                ])
            )
            // the coin goes up, down, stops hard and bounces once
            animations.push(
                timeline(coin, TOTAL, [
                    [start, `translateY(${fromY}px) rotate(0deg)`, SHARP],
                    [start + 200, `translateY(-68px) rotate(${tilt})`, SHARP],
                    [start + 500, `translateY(0px) rotate(${tilt})`, SPRING],
                    [start + 600, `translateY(-12px) rotate(${tilt})`, SHARP],
                    [start + 700, `translateY(0px) rotate(${tilt})`],
                ])
            )
        }
        if (hand.current) {
            animations.push(
                timeline(hand.current, TOTAL, [
                    [1700, 'scale(0) rotate(-8deg)', HOLD],
                    [1720, 'scale(1.15) rotate(-8deg)', SPRING],
                    [2020, 'scale(1) rotate(-3deg)', HOLD],
                    [2250, 'scale(1) rotate(-3deg)', SHARP],
                    [2450, 'scale(0) rotate(-3deg)'],
                ])
            )
        }
        return () => animations.forEach((animation) => animation.cancel())
    }, [reduced])

    return (
        <>
            <div className="absolute top-[120px] left-0 flex h-[110px] w-[316px] flex-col items-center justify-center rounded-sm border-2 border-border-default bg-background-default shadow-4">
                <p className="text-body-m">You paid</p>
                <p className="text-heading-l">25 EUR</p>
            </div>
            {Array.from({ length: COINS }, (_, index) => (
                <div
                    key={index}
                    ref={(element) => {
                        wraps.current[index] = element
                    }}
                    className={`absolute top-[68px] size-[56px] [transform:scale(0)] ${COIN_LEFT[index]}`}
                >
                    <Image
                        ref={(element) => {
                            coins.current[index] = element
                        }}
                        src={index % 2 ? coinEur : coinUsd}
                        alt=""
                        className="size-full drop-shadow-[2px_2px_0_var(--color-border-default)]"
                    />
                </div>
            ))}
            <Image
                ref={hand}
                src={stackCoin}
                alt=""
                className="absolute top-[52px] left-[210px] w-[104px] origin-[40%_80%] [transform:scale(0)] drop-shadow-[3px_3px_0_var(--color-border-default)]"
            />
        </>
    )
}
