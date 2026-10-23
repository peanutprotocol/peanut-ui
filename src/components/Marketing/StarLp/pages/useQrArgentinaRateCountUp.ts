'use client'

import { useEffect, useState } from 'react'
import { qrArgentinaRateAt, qrArgentinaRateCountFrom } from './qrArgentinaRate.utils'
import type { QrArgentinaRateCountUp } from './qrArgentina.types'

const COUNT_UP_MS = 1400

/**
 * Counts the live rate up once, from the power of ten below it, when the
 * watched element (the headline's number) scrolls in. Same arming rule as
 * useEntranceArm: the server, a no-JS visitor, reduced motion and a number
 * already on screen at mount all get the live rate at rest; the count only
 * arms while the number is below the viewport. The start value goes in on the
 * frame the count starts, as the number's first pixel enters the viewport, and
 * lasts only while it counts: at every other moment (a full-page screenshot, a
 * print, a visitor whose observer never fires) the DOM holds the live rate.
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
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return
            observer.disconnect()
            const start = performance.now()
            const tick = (now: number) => {
                const progress = (now - start) / COUNT_UP_MS
                if (progress >= 1) return setCounting(null)
                setCounting(qrArgentinaRateAt(from, rate, progress))
                frame = requestAnimationFrame(tick)
            }
            setCounting(from)
            frame = requestAnimationFrame(tick)
        })
        observer.observe(node)
        return () => {
            observer.disconnect()
            cancelAnimationFrame(frame)
            setCounting(null)
        }
    }, [node, rate])

    return { ref: setNode, shown: counting ?? rate }
}
