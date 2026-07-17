'use client'

import { NextIntlClientProvider, IntlErrorCode, type IntlError } from 'next-intl'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { DEFAULT_APP_LOCALE, type AppLocale } from './config'
import { loadMessages, type AppMessages } from './messages'
import { localeReady, markLocaleApplied, persistLocale } from './locale-store'
import en from './messages/en.json'

interface AppLocaleContextValue {
    locale: AppLocale
    setLocale: (locale: AppLocale) => Promise<void>
}

const AppLocaleContext = createContext<AppLocaleContextValue | null>(null)

export function useAppLocale(): AppLocaleContextValue {
    const ctx = useContext(AppLocaleContext)
    if (!ctx) throw new Error('useAppLocale must be used within AppIntlProvider')
    return ctx
}

function onIntlError(error: IntlError): void {
    if (error.code === IntlErrorCode.MISSING_MESSAGE) {
        // unreachable for valid keys (catalogs are deep-merged over English);
        // never crash on copy in production
        if (process.env.NODE_ENV !== 'production') console.warn(error.message)
        return
    }
    console.error(error)
}

export function AppIntlProvider({ children }: { children: React.ReactNode }) {
    /* SSR and the first client render must both use English so the hydration
       passes match; the real locale is resolved and swapped in an effect. */
    const [{ locale, messages }, setIntlState] = useState<{ locale: AppLocale; messages: AppMessages }>({
        locale: DEFAULT_APP_LOCALE,
        messages: en,
    })
    const startupLocale = useRef<AppLocale | null>(null)

    useEffect(() => {
        let cancelled = false
        localeReady().then(async (resolved) => {
            startupLocale.current = resolved
            if (resolved === DEFAULT_APP_LOCALE) {
                // already rendered in English — nothing to swap
                markLocaleApplied()
                return
            }
            if (cancelled) return
            const loaded = await loadMessages(resolved)
            if (!cancelled) setIntlState({ locale: resolved, messages: loaded })
        })
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        document.documentElement.lang = locale
        // signal "startup locale is painted" — the native splash gates on this
        if (locale === startupLocale.current) markLocaleApplied()
    }, [locale])

    const setLocale = useCallback(async (next: AppLocale) => {
        persistLocale(next)
        const loaded = await loadMessages(next)
        setIntlState({ locale: next, messages: loaded })
    }, [])

    return (
        <AppLocaleContext.Provider value={{ locale, setLocale }}>
            <NextIntlClientProvider
                locale={locale}
                messages={messages}
                timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
                onError={onIntlError}
            >
                {children}
            </NextIntlClientProvider>
        </AppLocaleContext.Provider>
    )
}
