'use client'

import { createContext, useContext } from 'react'
import type { AppLocale } from './config'

export interface AppLocaleContextValue {
    locale: AppLocale
    setLocale: (locale: AppLocale) => Promise<void>
}

/*
 * Lives apart from the providers so consumers (Settings, Profile) can read the
 * locale without importing a message catalog. The marketing and app providers
 * both fill this same context.
 */
export const AppLocaleContext = createContext<AppLocaleContextValue | null>(null)

export function useAppLocale(): AppLocaleContextValue {
    const ctx = useContext(AppLocaleContext)
    if (!ctx) throw new Error('useAppLocale must be used within an intl provider')
    return ctx
}
