'use client'

import { animate } from 'framer-motion'
import Image from 'next/image'
import { useRef, useState, type MouseEvent } from 'react'
import activityCapture from '@/assets/star-lp/request-links-activity.webp'
import { STAR_LP_SPRING, STORY_BEAT_ATTR } from '@/components/Marketing/StarLp/starLp.consts'
import { useStoryStep } from '@/components/Marketing/StarLp/useStoryStep'
import { twMerge } from '@/utils/tw'
import { RequestLinksAppLink } from './RequestLinksAppLink'
import { REQUEST_LINKS_CLIENT_SEES_ID, REQUEST_LINKS_STEP_MS, REQUEST_LINKS_STORY } from './requestLinks.consts'
import type { RequestLinksTimelineStop } from './requestLinks.types'

/** Gap between the stops' emphasis after a press. */
const EMPHASIS_GAP_S = 0.15
const screen = 'grid gap-1 rounded-card border-2 border-border-default bg-background-default p-3 text-body-s shadow-2'
const screenTitle = 'text-label-l'
const big = 'text-heading-s'
/** A drawn button with the DS press. It points at the next stop; it moves no money. */
const button =
    'mt-1 cursor-pointer rounded-full border-2 border-border-default py-1 text-center text-label-m shadow-2 transition-[transform,box-shadow] duration-instant active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-[3px] focus-visible:outline-action-focus'

/**
 * Fold 3: one payment from request to balance, a stop at a time, once. The rail
 * draws down to each stop as it arrives and ends at the last dot. Share and
 * Confirm never hide a stop: they scroll to the next one and nudge each later
 * stop in turn, ending with the Activity capture popping. Under reduced motion
 * an outline marks the next stop instead.
 */
export function RequestLinksTimeline() {
    const stopsCount = 4
    const { ref, step, complete } = useStoryStep(stopsCount, REQUEST_LINKS_STEP_MS)
    const [marked, setMarked] = useState<number | null>(null)
    const stopRefs = useRef<(HTMLDivElement | null)[]>([])
    const dotRefs = useRef<(HTMLSpanElement | null)[]>([])
    const cardRefs = useRef<(HTMLDivElement | null)[]>([])

    /** Points at the stops after `from`: scroll to the next, then a dot pulse and card nudge on each. */
    const emphasizeAfter = (from: number) => (event: MouseEvent) => {
        event.stopPropagation()
        complete()
        const next = from + 1
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        stopRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
        if (reduced) {
            setMarked(next)
            return
        }
        for (let i = next; i < stopsCount; i++) {
            const delay = (i - next) * EMPHASIS_GAP_S
            const dot = dotRefs.current[i]
            const card = cardRefs.current[i]
            if (dot) animate(dot, { scale: [1, 1.6, 1] }, { duration: 0.24, delay })
            if (!card) continue
            if (i === stopsCount - 1) {
                animate(card, { scale: [0.96, 1] }, { ...STAR_LP_SPRING.pop, delay: delay + 0.1 })
            } else {
                animate(card, { y: [0, -4, 0] }, { duration: 0.24, delay })
            }
        }
    }

    const stops: RequestLinksTimelineStop[] = [
        {
            time: '10:14',
            screen: (
                <div className={screen}>
                    <span className={screenTitle}>Request</span>
                    <span className={big}>{REQUEST_LINKS_STORY.amount}</span>
                    <span className="text-foreground-secondary">{REQUEST_LINKS_STORY.note}</span>
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={emphasizeAfter(0)}
                        className={`${button} bg-background-accent-yellow`}
                    >
                        Share {REQUEST_LINKS_STORY.amount} request
                    </button>
                </div>
            ),
        },
        {
            time: '10:15',
            screen: (
                <div className={screen}>
                    <span className={screenTitle}>Re: {REQUEST_LINKS_STORY.note}</span>
                    <span className="text-foreground-secondary">Thanks! Here you go:</span>
                    <RequestLinksAppLink
                        to={REQUEST_LINKS_CLIENT_SEES_ID}
                        className="w-fit text-label-m [overflow-wrap:anywhere] underline"
                    >
                        {REQUEST_LINKS_STORY.url}
                    </RequestLinksAppLink>
                </div>
            ),
        },
        {
            time: '17:30',
            screen: (
                <div className={screen}>
                    <span className={screenTitle}>Exchange · Send</span>
                    <span className={big}>{REQUEST_LINKS_STORY.amount}</span>
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={emphasizeAfter(2)}
                        className={`${button} bg-background-brand`}
                    >
                        Confirm
                    </button>
                </div>
            ),
        },
        {
            time: '17:34',
            screen: (
                <RequestLinksAppLink>
                    <span className="rl-lift shadow-2 block overflow-hidden rounded-card border-2 border-border-default bg-background-page">
                        <Image
                            src={activityCapture}
                            alt={`Activity: a wallet address, receive, +${REQUEST_LINKS_STORY.amount}`}
                            sizes="(min-width: 768px) 320px, 70vw"
                            className="h-auto w-full"
                        />
                    </span>
                </RequestLinksAppLink>
            ),
        },
    ]

    return (
        <div ref={ref} className="mx-auto grid w-full max-w-[420px] gap-6 lg:[zoom:1.25]" onClick={complete}>
            {stops.map(({ time, screen: stopScreen }, i) => (
                <div
                    key={time}
                    ref={(el) => {
                        stopRefs.current[i] = el
                    }}
                    className="star-lp-beat relative grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-2 pl-8 md:grid-cols-[5rem_minmax(0,1fr)]"
                    data-shown={i < step}
                    {...{ [STORY_BEAT_ATTR]: i }}
                >
                    {/* The rail from this dot to the next one (the gap is 1.5rem, the dot sits 6px down). It draws when the next stop arrives. */}
                    {i < stopsCount - 1 && (
                        <span
                            aria-hidden
                            className="absolute top-[22px] -bottom-[30px] left-[9px] origin-top border-l-[3px] border-dotted border-border-default transition-transform duration-slow ease-spring motion-reduce:transition-none"
                            style={{ transform: `scaleY(${i + 1 < step ? 1 : 0})` }}
                        />
                    )}
                    <span
                        ref={(el) => {
                            dotRefs.current[i] = el
                        }}
                        className="absolute top-1.5 left-0.5 size-4 rounded-full border-2 border-border-default bg-background-brand"
                    />
                    <span className="text-heading-xs">{time}</span>
                    <div
                        ref={(el) => {
                            cardRefs.current[i] = el
                        }}
                        className={twMerge(
                            'rounded-card',
                            marked === i && 'outline-[3px] outline-offset-2 outline-action-focus'
                        )}
                    >
                        {stopScreen}
                    </div>
                </div>
            ))}
        </div>
    )
}
