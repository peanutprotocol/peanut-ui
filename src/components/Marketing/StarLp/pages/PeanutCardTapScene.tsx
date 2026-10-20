'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import receiptCapture from '@/assets/star-lp/peanut-card-receipt.webp'
import { STAR_LP_SPRING } from '@/components/Marketing/StarLp/starLp.consts'
import { PeanutCardTerminal } from './PeanutCardTerminal'
import { PeanutCardWalletScreen } from './PeanutCardWalletScreen'

// Phases of one tap, in order: wallet up and the reader waiting at $4.50;
// the phone lifts onto the reader; contact (the reader approves); the phone
// drops back and the wallet sheet slides away to the Peanut receipt; the
// amount gets circled.
const READY = 0
const SWING = 1
const CONTACT = 2
const PAID = 3
const CIRCLED = 4

// Before the swing: the first play starts with the wallet already up; a
// replay waits for the sheet to rise first.
const FIRST_LEAD_MS = 350
const REPLAY_LEAD_MS = 500
const SWING_MS = 300
// From the swing until the phone pulls back.
const TAP_HOLD_MS = 750
const CIRCLE_AFTER_MS = 650
// Reduced motion: how long the wallet state shows before the receipt.
const REDUCED_HOLD_MS = 1200

const RING_SHOWN = { opacity: 1, scale: 1, rotate: -2 }
const RING_HIDDEN = { opacity: 0, scale: 1.35, rotate: -10 }

/**
 * The card fold's scene: an in-person tap with the phone wallet at a shop
 * reader, then the receipt in Peanut. The reader sits on top as one short row;
 * the phone screen below it is the app's real receipt sheet (fixture
 * `history-card-spend`, cropped to the sheet by
 * inbox/lp-refresh-2026/captures/peanut-card-capture.mjs), under a drawn wallet
 * sheet (OS UI) that slides away after the tap.
 *
 * Like useStoryStep, the server, a no-JS visitor and the first client render
 * get the end state: approved, receipt shown, amount circled. After mount, a
 * scene that starts fully below the viewport resets to the wallet and plays
 * its tap once, when half of it is in view; a scene already on screen stays
 * complete, so nothing visible disappears. A tap on the scene plays it again.
 * After the story, the reader pings until the first tap. Under reduced motion
 * the scene stays complete, and a tap swaps straight between the two states.
 */
export function PeanutCardTapScene() {
    const [phase, setPhase] = useState(CIRCLED)
    const [tapId, setTapId] = useState(0)
    const [inView, setInView] = useState(false)
    const [tappedByVisitor, setTappedByVisitor] = useState(false)
    const node = useRef<HTMLDivElement>(null)
    const timers = useRef<number[]>([])
    const running = useRef(false)
    const played = useRef(true)
    const reduced = useRef(false)

    const play = (lead: number) => {
        played.current = true
        running.current = true
        timers.current.forEach((id) => window.clearTimeout(id))
        timers.current = []
        const at = (ms: number, run: () => void) => timers.current.push(window.setTimeout(run, ms))
        setPhase(READY)
        if (reduced.current) {
            at(REDUCED_HOLD_MS, () => {
                setPhase(CIRCLED)
                running.current = false
            })
            return
        }
        at(lead, () => {
            setPhase(SWING)
            setTapId((n) => n + 1)
        })
        at(lead + SWING_MS, () => setPhase(CONTACT))
        at(lead + TAP_HOLD_MS, () => setPhase(PAID))
        at(lead + TAP_HOLD_MS + CIRCLE_AFTER_MS, () => {
            setPhase(CIRCLED)
            running.current = false
        })
    }

    useEffect(() => {
        const el = node.current
        if (!el) return
        reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        // Arm the first play only when the scene starts below the viewport,
        // so the visitor never sees the receipt vanish.
        if (!reduced.current && el.getBoundingClientRect().top >= window.innerHeight) {
            played.current = false
            setPhase(READY)
        }
        const io = new IntersectionObserver(
            ([entry]) => {
                setInView(entry.isIntersecting)
                if (!played.current && entry.intersectionRatio >= 0.5) play(FIRST_LEAD_MS)
            },
            { threshold: [0, 0.5] }
        )
        io.observe(el)
        const pending = timers.current
        return () => {
            io.disconnect()
            pending.forEach((id) => window.clearTimeout(id))
        }
    }, [])

    // Any tap on the scene plays the tap again; the phone's button gives
    // keyboards the same click, which bubbles here. A ref, not state, so a
    // double tap starts one replay.
    const replay = () => {
        setTappedByVisitor(true)
        if (running.current) return
        play(played.current ? REPLAY_LEAD_MS : FIRST_LEAD_MS)
    }

    const swung = phase === SWING || phase === CONTACT
    const approved = phase >= CONTACT
    const paid = phase >= PAID
    const inviting = phase === CIRCLED && inView && !tappedByVisitor

    return (
        <div
            ref={node}
            onClick={replay}
            className="group/scene mx-auto flex w-full max-w-sm cursor-pointer flex-col gap-5 md:max-w-[22rem] md:pr-3 lg:max-w-sm lg:pr-0"
        >
            <p className="sr-only">
                A shop reader asks for $4.50. A phone with the Peanut Card in its wallet taps the reader, the reader
                approves, and Peanut shows the receipt: paid $4.50 to Corner Coffee.
            </p>
            <div aria-hidden className="relative z-10">
                <PeanutCardTerminal approved={approved} tapping={phase === CONTACT} tapId={tapId} inviting={inviting} />
            </div>

            {/* The tap: the phone lifts onto the reader's contactless mark and back. */}
            <div
                className={`transition-transform duration-300 ease-out motion-reduce:transition-none ${swung ? '-translate-y-[14%] rotate-[3deg]' : ''}`}
            >
                {/* Hover nudges the phone toward the reader, a preview of the tap. */}
                <div className="transition-transform duration-300 ease-out motion-safe:group-hover/scene:-translate-y-[4px] motion-safe:group-hover/scene:rotate-1">
                    <button
                        type="button"
                        aria-label="Replay the tap"
                        className="block w-full -rotate-1 rounded-[1.75rem] transition-transform duration-150 select-none focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-border-default active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
                    >
                        <div className="overflow-hidden rounded-[1.75rem] border-4 border-border-default bg-background-default shadow-4">
                            <div className="relative overflow-hidden">
                                <Image
                                    src={receiptCapture}
                                    alt=""
                                    sizes="(min-width: 1024px) 384px, (min-width: 768px) 352px, 92vw"
                                    className="block h-auto w-full"
                                />
                                {/* The circled amount: what the reader asked is what left the balance. Stamped on. */}
                                <motion.span
                                    aria-hidden
                                    className="pointer-events-none absolute top-[36%] left-[34%] h-[18%] w-[32%] rounded-full border-[3px] border-pink-700"
                                    initial={false}
                                    animate={phase >= CIRCLED ? RING_SHOWN : RING_HIDDEN}
                                    transition={phase >= CIRCLED ? STAR_LP_SPRING.drop : { duration: 0 }}
                                />
                                {/* The wallet sheet: rises from the bottom, slides away after the tap. */}
                                <div
                                    className={`absolute inset-0 transition-transform motion-reduce:transition-none ${paid ? 'translate-y-[105%] duration-[350ms] ease-in' : 'translate-y-0 duration-300 ease-spring'}`}
                                >
                                    <PeanutCardWalletScreen approved={approved} />
                                </div>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    )
}
