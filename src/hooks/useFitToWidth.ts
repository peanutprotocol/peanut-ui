'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Returns a [ref, scale] pair that auto-scales fixed-pixel content to fit
 * the host element's current width. Used by ScaledShareAsset (1200×675)
 * and ScaledPixelatedCardFace (620×391) — both need the same
 * ResizeObserver / clientWidth dance and both have to handle the initial
 * "scale=0 until measured" guard.
 *
 * CSS container queries (`100cqw`) don't propagate reliably through every
 * wrapper (drawers, modals, flex columns), hence the JS measure.
 */
export function useFitToWidth(nativeWidth: number): {
    hostRef: React.MutableRefObject<HTMLDivElement | null>
    scale: number
} {
    const hostRef = useRef<HTMLDivElement | null>(null)
    const [scale, setScale] = useState(0)

    useEffect(() => {
        const host = hostRef.current
        if (!host) return
        const measure = (): void => {
            const w = host.clientWidth
            if (w > 0) setScale(Math.min(1, w / nativeWidth))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(host)
        return () => ro.disconnect()
    }, [nativeWidth])

    return { hostRef, scale }
}
