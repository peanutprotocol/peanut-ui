'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FocusEvent } from 'react'
import { HOME_PERSONA_CYCLE_MS } from './homePersona.consts'
import type { HomePersonaCycleState } from './homePersona.types'

/**
 * Cycles through `count` earners, one every `cycleMs`. It runs only after
 * mount, with motion allowed, while the stage is on screen and neither hovered
 * nor holding keyboard focus, and the document is visible. Picking an earner stops
 * the cycle for good. The server and the first render show the first earner.
 */
export function useHomePersonaCycle(count: number, cycleMs: number = HOME_PERSONA_CYCLE_MS): HomePersonaCycleState {
    const [index, setIndex] = useState(0)
    const [picked, setPicked] = useState(false)
    const [node, setNode] = useState<HTMLElement | null>(null)
    const [motionAllowed, setMotionAllowed] = useState(false)
    const [onScreen, setOnScreen] = useState(false)
    const [hovered, setHovered] = useState(false)
    const [focused, setFocused] = useState(false)
    const [documentVisible, setDocumentVisible] = useState(false)

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)')
        const update = () => {
            setMotionAllowed(!query.matches)
            if (query.matches) setIndex(0)
        }
        update()
        query.addEventListener('change', update)
        return () => query.removeEventListener('change', update)
    }, [])

    useEffect(() => {
        const update = () => setDocumentVisible(document.visibilityState === 'visible')
        update()
        document.addEventListener('visibilitychange', update)
        return () => document.removeEventListener('visibilitychange', update)
    }, [])

    useEffect(() => {
        if (!node || typeof IntersectionObserver === 'undefined') return
        const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.4 })
        io.observe(node)
        return () => io.disconnect()
    }, [node])

    const running = count > 1 && motionAllowed && onScreen && documentVisible && !hovered && !focused && !picked

    useEffect(() => {
        if (!running) return
        const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), cycleMs)
        return () => window.clearTimeout(id)
    }, [running, index, count, cycleMs])

    const select = useCallback(
        (next: number) => {
            if (!motionAllowed) return
            setPicked(true)
            setIndex(next)
        },
        [motionAllowed]
    )

    return {
        index,
        select,
        picked,
        reducedMotion: !motionAllowed,
        ref: setNode,
        pauseHandlers: {
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
            onFocus: () => setFocused(true),
            onBlur: (event: FocusEvent<HTMLElement>) => {
                // focus moving between the avatars keeps the pause
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
            },
        },
    }
}
