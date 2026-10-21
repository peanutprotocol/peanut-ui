'use client'

import { useEffect, useState } from 'react'
import { qrArgentinaRateAt, qrArgentinaRateCountFrom } from './qrArgentinaRate.utils'
import type { QrArgentinaRateCountUp } from './qrArgentina.types'

const COUNT_UP_MS = 1400
// Most of the number on screen before it counts, so the climb is seen from its start.
const IN_VIEW_THRESHOLD = 0.6
// The start value goes in only once the number is this close under the viewport
// (still off screen), so the DOM holds the live rate until the count is imminent.
const PRIME_MARGIN = '0px 0px 20% 0px'

/**
 * Counts the live rate up once, from the power of ten below it, when the
 * watched element (the headline's number) scrolls in. Same arming rule as
 * useEntranceArm: the server, a no-JS visitor, reduced motion and a number
 * already on screen at mount all get the live rate at rest; the count only
 * arms while the number is below the viewport. Until the number is about to
 * enter, the DOM keeps the live rate, so a full-page screenshot, print or a
 * visitor whose observer never fires never sees the start value.
 */
export function useQrArgentinaRateCountUp(rate: number | null): QrArgentinaRateCountUp {
    const [node, setNode] = useState<HTMLElement | null>(null)
    // `null` when idle: then the live rate itself shows, also after a revalidated rate arrives.
    const [counting, setCounting] = useState<number | null>(null)

    useEffect(() => {
        if (!node || rate === null) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        if (node.getBoundingClientRect().top < window.innerHeight) return

        const from = qrArgentinaRateCountFrom(rate)
        let frame = 0
        const prime = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return
                prime.disconnect()
                // Still below the viewport bottom: the swap to the start value is not seen.
                if (entry.boundingClientRect.top >= window.innerHeight) setCounting(from)
            },
            { rootMargin: PRIME_MARGIN }
        )
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return
                observer.disconnect()
                prime.disconnect()
                const start = performance.now()
                const tick = (now: number) => {
                    const progress = (now - start) / COUNT_UP_MS
                    if (progress >= 1) return setCounting(null)
                    setCounting(qrArgentinaRateAt(from, rate, progress))
                    frame = requestAnimationFrame(tick)
                }
                frame = requestAnimationFrame(tick)
            },
            { threshold: IN_VIEW_THRESHOLD }
        )
        prime.observe(node)
        observer.observe(node)
        return () => {
            prime.disconnect()
            observer.disconnect()
            cancelAnimationFrame(frame)
            setCounting(null)
        }
    }, [node, rate])

    return { ref: setNode, shown: counting ?? rate }
}
