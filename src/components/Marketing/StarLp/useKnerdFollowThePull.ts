'use client'

import { useEffect, useRef } from 'react'
import { startKnerdPull } from './knerdPullController'

/** Attach to the Follow the pull headline root; the controller owns the motion outside React state. */
export function useKnerdFollowThePull() {
    const ref = useRef<HTMLSpanElement>(null)
    useEffect(() => {
        if (!ref.current) return
        return startKnerdPull(ref.current)
    }, [])
    return ref
}
