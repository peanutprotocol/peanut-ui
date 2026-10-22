'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { STORY_BEAT_ATTR, STORY_STEP_MS } from './starLp.consts'
import type { StoryStepState } from './starLp.types'

type StoryPhase = 'idle' | 'running' | 'done'

/** Keys that scroll the page: pressing one while a story runs shows the rest. */
const SCROLL_KEYS = new Set([' ', 'Spacebar', 'PageDown', 'ArrowDown', 'End'])

/**
 * A one-shot story timeline (Split's PassTheLink pattern). The server, a no-JS
 * visitor and the first client render get the story complete (`step ===
 * count`), so a story in the first viewport paints with the page even if the
 * bundle is slow or fails. After mount, with motion allowed, the story arms
 * from the first beat that starts fully below the viewport: every beat already
 * on screen (and every earlier beat) stays shown, so nothing visible
 * disappears, and the rest play once in view. Beats are found by their
 * `data-story-beat` index (STORY_BEAT_ATTR); without markers the whole element
 * counts as beat 0. A story with no hidden beats left plays from 0 when 35% of
 * it (or 35% of the viewport) is in view; a partly shown story plays its
 * remaining beats when the first hidden one rises past 85% of the viewport.
 * `complete` only acts while it is running.
 */
export function useStoryStep(count: number, stepMs: number = STORY_STEP_MS): StoryStepState {
    const [step, setStep] = useState(count)
    const [node, setNode] = useState<HTMLElement | null>(null)
    const timers = useRef<number[]>([])
    // the active play trigger: an IntersectionObserver, or the scroll check
    const observer = useRef<{ disconnect: () => void } | null>(null)
    const phase = useRef<StoryPhase>('idle')
    const armed = useRef(false)
    const startAt = useRef(0)
    const beatOffset = useRef(0)

    const clearTimers = () => {
        timers.current.forEach((id) => window.clearTimeout(id))
        timers.current = []
    }

    const finish = useCallback(() => {
        clearTimers()
        observer.current?.disconnect()
        phase.current = 'done'
        setStep(count)
    }, [count])

    const complete = useCallback(() => {
        if (phase.current === 'running') finish()
    }, [finish])

    useEffect(() => {
        if (!node || phase.current === 'done') return
        if (!armed.current) {
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            const start = reduced ? count : firstHiddenBeat(node, count)
            if (start >= count) {
                // Reduced motion, or every beat already on screen: stay complete.
                phase.current = 'done'
                setStep(count)
                return
            }
            armed.current = true
            startAt.current = start
            beatOffset.current = beatTopOffset(node, start)
            setStep(start)
        }
        const start = startAt.current
        const play = () => {
            observer.current?.disconnect()
            phase.current = 'running'
            for (let i = start + 1; i <= count; i++) {
                timers.current.push(
                    window.setTimeout(
                        () => {
                            setStep(i)
                            if (i === count) phase.current = 'done'
                        },
                        (i - start - 1) * stepMs
                    )
                )
            }
        }
        // A partly shown story: play the rest when the first hidden beat's top
        // (measured at mount, while shown) rises past 85% of the viewport. A
        // scroll check, not an observer, because a hidden beat can sit in a
        // clipped box that never intersects.
        if (start > 0) {
            const check = () => {
                if (phase.current !== 'idle') return
                if (node.getBoundingClientRect().top + beatOffset.current < window.innerHeight * 0.85) play()
            }
            const stop = () => {
                window.removeEventListener('scroll', check)
                window.removeEventListener('resize', check)
            }
            observer.current = { disconnect: stop }
            window.addEventListener('scroll', check, { passive: true })
            window.addEventListener('resize', check)
            check()
        } else {
            const io = new IntersectionObserver(
                ([entry]) => {
                    if (!entry.isIntersecting || phase.current !== 'idle') return
                    const viewport = entry.rootBounds?.height ?? window.innerHeight
                    const enough = entry.intersectionRatio >= 0.35 || entry.intersectionRect.height >= viewport * 0.35
                    if (enough) play()
                },
                { threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1] }
            )
            observer.current = io
            io.observe(node)
        }
        const onKey = (event: KeyboardEvent) => {
            if (SCROLL_KEYS.has(event.key)) complete()
        }
        window.addEventListener('keydown', onKey)
        return () => {
            observer.current?.disconnect()
            window.removeEventListener('keydown', onKey)
            clearTimers()
            // an interrupted run starts over on the next mount
            if (phase.current === 'running') {
                phase.current = 'idle'
                setStep(start)
            }
        }
    }, [node, count, stepMs, finish, complete])

    return { ref: setNode, step, complete }
}

/**
 * The index of the first beat to hide: one past the last beat whose top is
 * already above the bottom of the viewport. Measured while every beat is shown.
 */
function firstHiddenBeat(node: HTMLElement, count: number): number {
    const fold = window.innerHeight
    const beats = node.querySelectorAll<HTMLElement>(`[${STORY_BEAT_ATTR}]`)
    if (beats.length === 0) return node.getBoundingClientRect().top < fold ? count : 0
    let start = 0
    beats.forEach((beat) => {
        const index = Number(beat.getAttribute(STORY_BEAT_ATTR))
        if (Number.isFinite(index) && beat.getBoundingClientRect().top < fold) start = Math.max(start, index + 1)
    })
    return Math.min(start, count)
}

/** The first hidden beat's top relative to the story's top, while every beat is shown. */
function beatTopOffset(node: HTMLElement, start: number): number {
    const beat = node.querySelector<HTMLElement>(`[${STORY_BEAT_ATTR}="${start}"]`)
    return beat ? beat.getBoundingClientRect().top - node.getBoundingClientRect().top : 0
}
