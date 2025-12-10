'use client'

import { useEffect, useState } from 'react'
import { usePWAStatus } from './usePWAStatus'
import { BrowserType, useGetBrowserType } from './useGetBrowserType'

type InstalledRelatedApp = { platform: string; url?: string; id?: string; version?: string }

/**
 * tracks whether the user is on Brave and has the Peanut PWA installed.
 *
 * combines:
 * - current PWA display mode (standalone/web)
 * - `navigator.getInstalledRelatedApps` (when available)
 * - `appinstalled` event
 */
export const useBravePWAInstallState = () => {
    const isStandalonePWA = usePWAStatus()
    const { browserType } = useGetBrowserType()
    const [hasInstalledRelatedApp, setHasInstalledRelatedApp] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined') return

        const _navigator = window.navigator as Navigator & {
            getInstalledRelatedApps?: () => Promise<InstalledRelatedApp[]>
        }

        if (typeof _navigator.getInstalledRelatedApps !== 'function') return

        let cancelled = false

        const checkInstallation = async () => {
            try {
                const installedApps = await _navigator.getInstalledRelatedApps!()
                if (!cancelled) {
                    setHasInstalledRelatedApp(installedApps.length > 0)
                }
            } catch {
                if (!cancelled) {
                    setHasInstalledRelatedApp(false)
                }
            }
        }

        void checkInstallation()

        const handleAppInstalled = () => {
            if (!cancelled) {
                setHasInstalledRelatedApp(true)
            }
        }

        window.addEventListener('appinstalled', handleAppInstalled)

        return () => {
            cancelled = true
            window.removeEventListener('appinstalled', handleAppInstalled)
        }
    }, [])

    const isPWAInstalled = isStandalonePWA || hasInstalledRelatedApp
    const isBrave = browserType === BrowserType.BRAVE
    const isBravePWAInstalled = isBrave && isPWAInstalled

    return { isBrave, isPWAInstalled, isBravePWAInstalled }
}
