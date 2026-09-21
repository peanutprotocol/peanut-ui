'use client'

import { useEffect } from 'react'
import { hideCrispLauncher, loadCrispChatbox, showCrispLauncher } from '@/utils/crisp-launcher'

/**
 * Owns the stock Crisp launcher for the marketing site.
 *
 * Mounted by the marketing layout, so the bubble's visibility follows that
 * layout's lifetime: shown while a marketing page is on screen, hidden the
 * moment a client-side navigation leaves for the app, where the support drawer
 * is the only way into Crisp. The widget itself stays loaded — hiding is
 * cheaper than tearing it down, and coming back shows it again.
 */
export function CrispLauncher() {
    useEffect(() => {
        loadCrispChatbox()
        showCrispLauncher()
        return () => hideCrispLauncher()
    }, [])

    return null
}
