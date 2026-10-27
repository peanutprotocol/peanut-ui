'use client'

import { useEffect, useState } from 'react'
import { advanceSlots } from './homeWallOfLove.utils'
import type { WallOfLoveCycleState } from './homeWallOfLove.types'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * Turns the wall's slots one at a time, every `stepMs`. The server and the
 * first render show each slot's first post. It runs only while the wall is on
 * screen, the tab is visible and motion is allowed, and it holds while a
 * pointer is over the wall or focus is inside it, so a card never changes
 * under the reader. `sizes` is the post count per slot; keep it stable.
 */
export function useWallOfLoveCycle(sizes: readonly number[], stepMs: number): WallOfLoveCycleState {
    const [active, setActive] = useState<number[]>(() => sizes.map(() => 0))
    const [node, setNode] = useState<HTMLElement | null>(null)

    useEffect(() => {
        if (!node || !sizes.some((size) => size > 1)) return
        const media = window.matchMedia(REDUCED_MOTION)
        let inView = false
        let hovered = false
        let focused = false
        let tick = 0
        let timer: number | undefined

        const sync = () => {
            const run = inView && !hovered && !focused && !document.hidden && !media.matches
            if (run && timer === undefined) {
                timer = window.setInterval(() => {
                    const slot = tick++
                    setActive((current) => advanceSlots(current, slot, sizes))
                }, stepMs)
            } else if (!run && timer !== undefined) {
                window.clearInterval(timer)
                timer = undefined
            }
        }

        const io = new IntersectionObserver(([entry]) => {
            inView = entry?.isIntersecting ?? false
            sync()
        })
        io.observe(node)
        const onEnter = () => {
            hovered = true
            sync()
        }
        const onLeave = () => {
            hovered = false
            sync()
        }
        const onFocusIn = () => {
            focused = true
            sync()
        }
        const onFocusOut = (event: FocusEvent) => {
            if (event.relatedTarget instanceof Node && node.contains(event.relatedTarget)) return
            focused = false
            sync()
        }
        node.addEventListener('pointerenter', onEnter)
        node.addEventListener('pointerleave', onLeave)
        node.addEventListener('focusin', onFocusIn)
        node.addEventListener('focusout', onFocusOut)
        document.addEventListener('visibilitychange', sync)
        media.addEventListener?.('change', sync)

        return () => {
            io.disconnect()
            if (timer !== undefined) window.clearInterval(timer)
            node.removeEventListener('pointerenter', onEnter)
            node.removeEventListener('pointerleave', onLeave)
            node.removeEventListener('focusin', onFocusIn)
            node.removeEventListener('focusout', onFocusOut)
            document.removeEventListener('visibilitychange', sync)
            media.removeEventListener?.('change', sync)
        }
    }, [node, sizes, stepMs])

    return { ref: setNode, active }
}
