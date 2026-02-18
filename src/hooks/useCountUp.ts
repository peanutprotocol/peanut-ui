'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

const STORAGE_PREFIX = 'peanut_points_'

interface UseCountUpOptions {
    /** localStorage key suffix for remembering last-seen value across visits */
    storageKey?: string
    /** Animation duration in seconds (default: 1.5) */
    duration?: number
    /** Only start when true — use with intersection observer for scroll-triggered animations */
    enabled?: boolean
}

/**
 * Animates a number from a previous value to the current value.
 *
 * - If `storageKey` is provided, remembers the last-seen value in localStorage
 *   so returning to the page animates from the old value to the new one.
 * - If `enabled` is false, waits to start (useful for scroll-into-view triggers).
 * - Returns the current animated integer value.
 */
export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
    const { storageKey, duration = 1.5, enabled = true } = options

    const [display, setDisplay] = useState(() => {
        if (!storageKey) return target
        if (typeof window === 'undefined') return target
        const stored = localStorage.getItem(STORAGE_PREFIX + storageKey)
        return stored ? parseInt(stored, 10) : target
    })

    const hasAnimated = useRef(false)
    const controlsRef = useRef<ReturnType<typeof animate> | null>(null)

    useEffect(() => {
        if (!enabled || hasAnimated.current) return

        const from = display
        const to = target

        // Nothing to animate
        if (from === to) {
            hasAnimated.current = true
            if (storageKey) {
                localStorage.setItem(STORAGE_PREFIX + storageKey, String(to))
            }
            return
        }

        hasAnimated.current = true

        controlsRef.current = animate(from, to, {
            duration,
            ease: [0.25, 0.1, 0.25, 1], // cubic-bezier — fast start, smooth decel
            onUpdate(value) {
                setDisplay(Math.round(value))
            },
            onComplete() {
                setDisplay(to)
                if (storageKey) {
                    localStorage.setItem(STORAGE_PREFIX + storageKey, String(to))
                }
            },
        })

        return () => {
            controlsRef.current?.stop()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- display intentionally excluded to avoid re-triggering
    }, [enabled, target, duration, storageKey])

    // if target changes after animation completed (e.g. refetch), update immediately
    useEffect(() => {
        if (hasAnimated.current && display !== target) {
            setDisplay(target)
            if (storageKey) {
                localStorage.setItem(STORAGE_PREFIX + storageKey, String(target))
            }
        }
    }, [target, display, storageKey])

    return display
}
