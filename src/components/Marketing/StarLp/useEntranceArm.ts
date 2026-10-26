'use client'

import { useEffect, useState } from 'react'
import type { EntranceArmState } from './starLp.types'

/**
 * The arming rule for PopIn / DropIn (peanutsplit's useSceneArm): the server,
 * a no-JS visitor and the first client render all get the element at rest, so
 * hero art paints with the page. After mount the entrance arms only when
 * motion is allowed and the element starts fully below the viewport, where
 * swapping it to its hidden start state cannot be seen. This is useStoryStep's
 * per-beat rule for a single beat: an element whose top is on screen is
 * visible, so hiding it would be seen.
 */
export function useEntranceArm(): EntranceArmState {
    const [node, setNode] = useState<HTMLElement | null>(null)
    const [armed, setArmed] = useState(false)

    useEffect(() => {
        if (!node || armed) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        if (node.getBoundingClientRect().top >= window.innerHeight) setArmed(true)
    }, [node, armed])

    return { ref: setNode, armed }
}
