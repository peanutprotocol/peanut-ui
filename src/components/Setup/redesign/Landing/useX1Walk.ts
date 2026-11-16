'use client'

import { useEffect, useState } from 'react'
import { subscribeToMascotClock } from '@/components/Global/PeanutMascot/PeanutMascot.utils'
import { clampStep, KEY_FRAME, WALK_FRAMES, worldFrameAt } from './x1-walk'

/** The world frame wraps here so the coin maths stays on small numbers; a whole number of walk cycles keeps the step even. */
const WRAP = 80 * WALK_FRAMES

/**
 * The world frame the X1 walk shows. It runs on the shared mascot clock, so the walker steps with every other mascot;
 * reduced motion holds the key frame. A hidden tab holds its frame and resumes without fast-forwarding. Unmount stops
 * the clock, so the walker and the coins freeze on the frame they show while the step slides out.
 */
export function useX1Walk(walking: boolean): number {
    const [frame, setFrame] = useState(KEY_FRAME)

    useEffect(() => {
        if (!walking) return
        let elapsed = 0
        let shown = KEY_FRAME
        return subscribeToMascotClock((deltaSeconds) => {
            if (document.hidden) return
            elapsed += clampStep(deltaSeconds)
            const next = worldFrameAt(elapsed) % WRAP
            if (next === shown) return
            shown = next
            setFrame(next)
        })
    }, [walking])

    return walking ? frame : KEY_FRAME
}
