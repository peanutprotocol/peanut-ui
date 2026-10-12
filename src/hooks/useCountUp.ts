'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'

const STORAGE_PREFIX = 'peanut_points_'
const clientHydrated = () => true
const serverHydrated = () => false

function previousPoints(storageKey: string | undefined, target: number): number {
    if (!storageKey) return target
    const stored = readStoredValue(STORAGE_PREFIX + storageKey)
    if (!stored?.trim()) return target
    const value = Number(stored)
    return Number.isSafeInteger(value) && value >= 0 ? value : target
}

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

    const hydrated = useHydrationSnapshot(clientHydrated, serverHydrated)
    const initialDisplay = useHydrationSnapshot(
        () => previousPoints(storageKey, target),
        () => target
    )
    const [display, setDisplay] = useState<number | null>(null)

    const hasAnimated = useRef(false)
    const isAnimating = useRef(false)
    const controlsRef = useRef<ReturnType<typeof animate> | null>(null)
    const prevTargetRef = useRef(target)

    useEffect(() => {
        if (!hydrated || !enabled || hasAnimated.current) return

        const from = display ?? initialDisplay
        const to = target

        // nothing to animate
        if (from === to) {
            hasAnimated.current = true
            if (storageKey) {
                writeStoredValue(STORAGE_PREFIX + storageKey, String(to))
            }
            return
        }

        hasAnimated.current = true
        isAnimating.current = true
        setDisplay(from)

        controlsRef.current = animate(from, to, {
            duration,
            ease: [0.25, 0.1, 0.25, 1],
            onUpdate(value) {
                setDisplay(Math.round(value))
            },
            onComplete() {
                isAnimating.current = false
                setDisplay(to)
                if (storageKey) {
                    writeStoredValue(STORAGE_PREFIX + storageKey, String(to))
                }
            },
        })

        return () => {
            controlsRef.current?.stop()
            isAnimating.current = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- display intentionally excluded to avoid re-triggering
    }, [enabled, target, duration, storageKey, hydrated, initialDisplay])

    // if target changes after animation completed (e.g. refetch), snap to new value
    useEffect(() => {
        if (prevTargetRef.current !== target && hasAnimated.current && !isAnimating.current) {
            setDisplay(target)
            if (storageKey) {
                writeStoredValue(STORAGE_PREFIX + storageKey, String(target))
            }
        }
        prevTargetRef.current = target
    }, [target, storageKey])

    return display ?? initialDisplay
}
