'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Band } from '@/components/Marketing/StarLp/Band'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { WALL_OF_LOVE_SLOTS, WALL_OF_LOVE_STEP_MS, WALL_OF_LOVE_TILTS } from './homeWallOfLove.consts'
import type { HomeWallOfLoveProps } from './homeWallOfLove.types'
import { dealIntoSlots } from './homeWallOfLove.utils'
import { useWallOfLoveCycle } from './useWallOfLoveCycle'
import { WallOfLoveCard } from './WallOfLoveCard'

/**
 * Each post sits in its slot's one grid cell. A post waiting its turn is clear,
 * 8px low and hidden (so out of the tab order and the accessibility tree).
 * Under reduced motion the stack unfolds and every post shows, still.
 */
const POST =
    'flex [grid-area:1/1] motion-safe:transition-[opacity,translate,visibility] motion-safe:duration-slow motion-safe:ease-out data-[shown=false]:invisible data-[shown=false]:translate-y-2 data-[shown=false]:opacity-0 motion-reduce:[grid-area:auto]! motion-reduce:visible! motion-reduce:translate-y-0! motion-reduce:opacity-100!'

/**
 * Real posts about Peanut as white sticker cards on pink, three at a time (a
 * row from md, a stack on phones). Each slot holds every third post of the
 * curated list stacked in one grid cell, so a slot is as tall as its longest
 * post and swapping posts never moves the page. One slot swaps every few
 * seconds, in turn; see useWallOfLoveCycle for when it holds. A small
 * pause control stops it for good (WCAG 2.2.2: a screen-reader cursor fires no
 * hover or focus, so the hold alone is not enough). Under reduced motion the
 * stacks unfold, the wall shows every post, still, and the control goes.
 */
export function HomeWallOfLove({ heading, pauseLabel, playLabel, posts }: HomeWallOfLoveProps) {
    const slots = useMemo(() => dealIntoSlots(posts, WALL_OF_LOVE_SLOTS), [posts])
    const sizes = useMemo(() => slots.map((slot) => slot.length), [slots])
    const [stopped, setStopped] = useState(false)
    const { ref, active } = useWallOfLoveCycle(sizes, WALL_OF_LOVE_STEP_MS, stopped)

    return (
        <Band ground="pink" id="wall-of-love">
            <SectionTitle className="text-center">{heading}</SectionTitle>
            <ul ref={ref} className="mt-10 grid gap-6 md:mt-14 md:grid-cols-3 md:gap-x-8">
                {slots.map((slot, s) => (
                    <li key={slot[0].url} className="flex">
                        <PopIn
                            delay={s * 0.1}
                            tilt={WALL_OF_LOVE_TILTS[s % WALL_OF_LOVE_TILTS.length]}
                            className="grid w-full gap-6 md:gap-y-10"
                        >
                            {slot.map((post, i) => (
                                <div key={post.url} data-shown={i === active[s]} className={POST}>
                                    <WallOfLoveCard post={post} />
                                </div>
                            ))}
                        </PopIn>
                    </li>
                ))}
            </ul>
            <div className="mt-6 flex justify-center motion-reduce:hidden">
                <Button variant="ghost" size="compact" className="w-auto" onClick={() => setStopped((value) => !value)}>
                    {stopped ? playLabel : pauseLabel}
                </Button>
            </div>
        </Band>
    )
}
