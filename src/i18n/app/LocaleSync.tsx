'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { USER } from '@/constants/query.consts'
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
    const queryClient = useQueryClient()
    // last locale actually applied, so the startup swap from the english ssr
    // default does not count as a switch
    const appliedLocale = useRef<string | null>(null)

    useEffect(() => {
        if (!userId) return
        let cancelled = false
        void localeReady().then((resolved) => {
            // a manual setLocale (already applied and persisted) wins over the
            // startup resolution
            if (cancelled) return
            const applied = currentAppLocale() ?? resolved
            syncLocaleToBackend(userId, applied)
            if (locale !== applied) return
            // the api localizes badge copy on /users/me, so refetch it in the new language
            if (appliedLocale.current && appliedLocale.current !== locale) {
                void queryClient.invalidateQueries({ queryKey: [USER] })
            }
            appliedLocale.current = locale
        })
        return () => {
            cancelled = true
        }
    }, [userId, locale, queryClient])

    return null
}
