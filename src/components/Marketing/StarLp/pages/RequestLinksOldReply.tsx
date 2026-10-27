'use client'

import { useInView } from 'framer-motion'
import { useRef } from 'react'
import HandThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import { StorySequence } from '@/components/Marketing/StarLp/StorySequence'
import { Wiggle } from '@/components/Marketing/StarLp/Wiggle'
import { RequestLinksAppLink } from './RequestLinksAppLink'
import { RequestLinksPaidTick } from './RequestLinksPaidTick'
import { REQUEST_LINKS_CLIENT_SEES_ID, REQUEST_LINKS_STORY } from './requestLinks.consts'

const OLD_THREAD = [
    { day: 'Mon', text: 'Send me your account details?', mine: false },
    { day: 'Mon', text: 'Name, number, SWIFT...', mine: true },
    { day: 'Tue', text: 'Which name is on the account?', mine: false },
    { day: 'Wed', text: 'Is it a business account?', mine: true },
    { day: 'Thu', text: 'It bounced.', mine: false },
    { day: 'Fri', text: 'Can you send them again?', mine: true },
] as const

/** Gap between the old thread's bubble stamps: six of them make a slow week of about 1.5s. */
const STAMP_GAP_MS = 220

const columnTitle = 'mb-3 text-heading-xs uppercase md:text-heading-s'
const bubble = 'rounded-card border-2 border-border-default px-3 py-2 text-label-m md:text-label-l'
const day = 'block text-body-xs text-foreground-secondary'

/**
 * Fold 1: the five-day bank-details thread beside the same-day link. When half
 * the fold is in view, the week's bubbles stamp one by one, then the paid check
 * pops and the glove hops (REQUEST_LINKS_MOTION_CSS, emphasis only: nothing
 * hides). On a phone the link side also plays as a story.
 */
export function RequestLinksOldReply() {
    const root = useRef<HTMLDivElement>(null)
    const inView = useInView(root, { once: true, amount: 0.5 })
    return (
        <div ref={root} className="rl-old grid grid-cols-2 gap-3 md:gap-6" data-play={inView}>
            <div>
                <p className={columnTitle}>A week</p>
                <div className="grid -rotate-1 gap-2">
                    {OLD_THREAD.map(({ day: d, text, mine }, i) => (
                        <div
                            key={text}
                            className={`rl-stamp ${bubble} bg-background-disabled ${mine ? 'ml-2' : 'mr-2'}`}
                            style={{ animationDelay: `${i * STAMP_GAP_MS}ms` }}
                        >
                            <span className={day}>{d}</span>
                            {text}
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <p className={columnTitle}>Same day</p>
                <StorySequence
                    stepMs={900}
                    className="grid gap-2"
                    beats={[
                        <div key="link" className={`${bubble} bg-background-badge-info`}>
                            <span className={day}>Mon 10:15</span>
                            Here you go:
                            <RequestLinksAppLink to={REQUEST_LINKS_CLIENT_SEES_ID} className="mt-2">
                                <span className="rl-lift shadow-2 block rounded border-2 border-border-default bg-yellow-500 px-2 py-2">
                                    <span className="block text-body-m-semibold">{REQUEST_LINKS_STORY.amount}</span>
                                    <span className="block text-body-xs">{REQUEST_LINKS_STORY.note}</span>
                                </span>
                            </RequestLinksAppLink>
                        </div>,
                        <RequestLinksPaidTick key="paid" className="rl-paid text-body-xs md:text-body-s">
                            Payment received
                        </RequestLinksPaidTick>,
                        <div key="glove" className="flex justify-center pt-2">
                            <span className="rl-hop inline-block">
                                <Wiggle kind="bounce" delay={2.4}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={HandThumbsUp.src}
                                        width={HandThumbsUp.width}
                                        height={HandThumbsUp.height}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                        aria-hidden
                                        className="w-16 md:w-20"
                                    />
                                </Wiggle>
                            </span>
                        </div>,
                    ]}
                />
            </div>
        </div>
    )
}
