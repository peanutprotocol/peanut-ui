'use client'

import { useEffect } from 'react'
import { isCapacitor } from '@/utils/capacitor'
import { hideCrispLauncher, scheduleCrispChatboxLoad, showCrispLauncher } from '@/utils/crisp-launcher'
import { isNativeHelpContext } from '@/utils/native-help-context'

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
        // Help opened from the native app already has a support entry point.
        // Its browser sheet has no Capacitor bridge, so check the carried
        // context too. Explicit support links may still open the chatbox;
        // closing it must hide the redundant bubble again.
        const hasNativeSupport = isCapacitor() || isNativeHelpContext()
        if (hasNativeSupport) {
            hideCrispLauncher()
            window.$crisp?.push(['on', 'chat:closed', () => window.$crisp?.push(['do', 'chat:hide'])])
        } else {
            showCrispLauncher()
        }

        // Queue visibility before loading so the native sheet never flashes
        // the launcher, and early explicit support taps can queue too.
        const cancelLoad = scheduleCrispChatboxLoad()

        return () => {
            cancelLoad()
            if (hasNativeSupport) window.$crisp?.push(['off', 'chat:closed'])
            hideCrispLauncher()
        }
    }, [])

    return null
}
