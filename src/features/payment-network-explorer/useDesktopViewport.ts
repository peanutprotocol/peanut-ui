'use client'

import { useEffect, useState } from 'react'

const DESKTOP_QUERY = '(min-width: 1024px)'

export function useDesktopViewport(): { ready: boolean; isDesktop: boolean } {
    const [state, setState] = useState({ ready: false, isDesktop: false })

    useEffect(() => {
        const media = window.matchMedia(DESKTOP_QUERY)
        const update = () => setState({ ready: true, isDesktop: media.matches })
        update()
        media.addEventListener('change', update)
        return () => media.removeEventListener('change', update)
    }, [])

    return state
}
