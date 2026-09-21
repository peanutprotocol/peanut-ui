'use client'

import { useEffect } from 'react'
import { hideCrispLauncher, scheduleCrispChatboxLoad, showCrispLauncher } from '@/utils/crisp-launcher'

/**
 * Owns the stock Crisp launcher for the marketing site.
 *
 * Mounted by the marketing layout, so the bubble's visibility follows that
 * layout's lifetime: shown while a marketing page is on screen, hidden the
 * moment a client-side navigation leaves for the app, where the support drawer
 * is the only way into Crisp. The widget itself stays loaded — hiding is
 * cheaper than tearing it down, and coming back shows it again.
 *
 * The bundle itself waits for the page's load event, so this third-party
 * script never competes with the app's own JavaScript on an SEO page.
 */
export function CrispLauncher() {
    useEffect(() => {
        // queue the show first: it costs nothing, and it means a `#chat` tap
        // before the bundle lands has a queue to land in
        showCrispLauncher()
        const cancelLoad = scheduleCrispChatboxLoad()

        return () => {
            cancelLoad()
            hideCrispLauncher()
        }
    }, [])

    return null
}
