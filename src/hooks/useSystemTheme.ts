'use client'

import { useEffect } from 'react'
import { DARK_MEDIA_QUERY, applyTheme, getSystemTheme } from '@/utils/theme'
import { syncNativeStatusBar } from '@/utils/native-theme'

/**
 * Keeps `data-theme` in sync with the OS appearance while the app is open.
 * The initial value is set pre-paint by THEME_INIT_SCRIPT; this handles live
 * changes (user flips system dark mode without reloading). Mount once, high in
 * the tree.
 */
export function useSystemTheme() {
    useEffect(() => {
        const mql = window.matchMedia(DARK_MEDIA_QUERY)

        const sync = () => {
            const theme = getSystemTheme()
            applyTheme(theme)
            syncNativeStatusBar(theme)
        }

        sync()
        mql.addEventListener('change', sync)
        return () => mql.removeEventListener('change', sync)
    }, [])
}
