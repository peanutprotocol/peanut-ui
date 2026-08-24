'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/authContext'
import { useAppLocale } from './AppIntlProvider'
import { currentAppLocale, localeReady } from './locale-store'
import { syncLocaleToBackend } from './locale-sync'

/**
 * Mirrors the user's last known language choice to the BE. Renders nothing.
 * Must mount below both AppIntlProvider and AuthProvider.
 *
 * Keyed on the provider locale so a manual switch in Settings syncs
 * immediately, but the synced value comes from localeReady()/currentAppLocale()
 * — the provider briefly shows the English SSR default before the startup
 * locale applies, and that transient value must never be persisted as a
 * "choice".
 */
export function LocaleSync() {
    const { userId } = useAuth()
    const { locale } = useAppLocale()

    useEffect(() => {
        if (!userId) return
        let cancelled = false
        void localeReady().then((resolved) => {
            // a manual setLocale (already applied and persisted) wins over the
            // startup resolution
            if (!cancelled) syncLocaleToBackend(userId, currentAppLocale() ?? resolved)
        })
        return () => {
            cancelled = true
        }
    }, [userId, locale])

    return null
}
