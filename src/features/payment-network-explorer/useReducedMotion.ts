'use client'

import { useEffect, useState } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)

    useEffect(() => {
        const media = window.matchMedia(REDUCED_MOTION_QUERY)
        const update = () => setReduced(media.matches)
        update()
        media.addEventListener('change', update)
        return () => media.removeEventListener('change', update)
    }, [])

    return reduced
}
