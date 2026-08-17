'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isCapacitor } from '@/utils/capacitor'
import { localeApplied } from '@/i18n/app/locale-store'

/*
 * Single owner of SplashScreen.hide() for native builds, mounted in
 * ClientProviders so BOTH cold-start destinations (/home and /setup) are
 * covered — the old call site lived in useNativePlugins, which only mounts
 * under (mobile-ui), so a logged-out cold start never hid the splash at all
 * and relied on the plugin's 500ms auto-hide. With launchAutoHide: false in
 * capacitor.config.ts the splash stays up until this hook drops it.
 *
 * Gates: route settled off the root redirect AND the startup locale painted
 * (so es/pt users never see an English flash). Deliberately NOT gated on
 * authReady() — that parks behind the biometric lock and would hold the
 * splash over the lock prompt forever.
 */

// Module-level: hide exactly once per document, across remounts.
let splashHidden = false
let hardTimeoutArmed = false

async function hideSplash() {
    if (splashHidden) return
    splashHidden = true
    try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide()
    } catch (e) {
        console.warn('failed to hide splash screen:', e)
    }
}

export function useSplashGate() {
    const pathname = usePathname()

    useEffect(() => {
        if (!isCapacitor() || splashHidden) return

        // A wedged router or i18n bug must never keep the splash up.
        if (!hardTimeoutArmed) {
            hardTimeoutArmed = true
            setTimeout(hideSplash, 3000)
        }

        if (pathname === '/') return

        let cancelled = false
        Promise.race([localeApplied(), new Promise((resolve) => setTimeout(resolve, 2000))]).then(() => {
            if (!cancelled) hideSplash()
        })
        return () => {
            cancelled = true
        }
    }, [pathname])
}
