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

/*
 * hide() unblocks the first frame, and on Android that frame is what runs the
 * system splash-screen teardown. Running it while the activity is backgrounded
 * hands the teardown a window that is gone by the time the app resumes and
 * actually draws, which crashed the process (PEANUT-UI-SVN, one Android 13
 * cold start backgrounded ~2s in and resumed 15s later). Park until the app is
 * foregrounded; a splash nobody can see is not worth a crash.
 */
async function whenActive(): Promise<void> {
    const { App } = await import('@capacitor/app')

    let resumed!: () => void
    const nextResume = new Promise<void>((resolve) => {
        resumed = resolve
    })

    // Listener first, state read second: appStateChange is never replayed, so a
    // resume landing between a false read and the registration would park the
    // splash for the rest of the launch.
    const listener = await App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
        if (isActive) resumed()
    })
    try {
        if ((await App.getState()).isActive) return
        await nextResume
    } finally {
        await listener.remove().catch(() => {})
    }
}

async function hideSplash() {
    if (splashHidden) return
    splashHidden = true
    try {
        await whenActive()
    } catch (e) {
        console.warn('failed to read native app state:', e)
    }
    try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide()
    } catch (e) {
        console.warn('failed to hide splash screen:', e)
    }
}

/**
 * Whether the native splash still covers the WebView. The OTA launch apply uses
 * it as its window: a reload behind the splash is invisible, the same reload a
 * second later yanks the app out from under someone already using it.
 */
export function isSplashVisible(): boolean {
    return !splashHidden
}

export function resetSplashGateForTests(): void {
    splashHidden = false
    hardTimeoutArmed = false
}

export function useSplashGate(): void {
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
