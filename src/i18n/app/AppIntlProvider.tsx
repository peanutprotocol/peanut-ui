'use client'

import { NextIntlClientProvider, IntlErrorCode, type IntlError } from 'next-intl'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { DEFAULT_APP_LOCALE, type AppLocale } from './config'
import { loadMessages, type AppMessages } from './messages'
import {
    currentAppLocale,
    emitDeviceContextToAnalytics,
    emitLocaleToAnalytics,
    localeReady,
    markLocaleApplied,
    persistLocale,
} from './locale-store'
import en from './messages/en.json'
import { isHtmlLangClaimed } from '../htmlLangClaim'

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
        // device_language + platform super properties for the localization OKR;
        // independent of which locale resolves, fire-and-forget
        void emitDeviceContextToAnalytics()
        localeReady().then(async (resolved) => {
            startupLocale.current = resolved
            if (resolved === DEFAULT_APP_LOCALE) {
                // already rendered in English — nothing to swap. Skip the emit
                // if a manual setLocale won the race: this path never calls
                // setIntlState, so the UI keeps the manual locale and emitting
                // the startup value would record a language nobody sees.
                if (!currentAppLocale()) emitLocaleToAnalytics(resolved)
                markLocaleApplied()
                return
            }
            if (cancelled) return
            const loaded = await loadMessages(resolved)
            if (!cancelled) {
                setIntlState({ locale: resolved, messages: loaded })
                // emit only after the catalog loaded — analytics report the
                // language the user actually sees, not a failed swap
                emitLocaleToAnalytics(resolved)
            }
        })
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        // Marketing/landing routes mount <HtmlLang> and own the attribute — their
        // content language is the URL locale, not the app-locale cookie. This
        // effect runs after theirs (parent effects commit last), so without the
        // guard it would overwrite the page locale on every localized route.
        if (!isHtmlLangClaimed()) document.documentElement.lang = locale
        // signal "startup locale is painted" — the native splash gates on this
        if (locale === startupLocale.current) markLocaleApplied()
    }, [locale])

    const setLocale = useCallback(async (next: AppLocale) => {
        persistLocale(next)
        const loaded = await loadMessages(next)
        setIntlState({ locale: next, messages: loaded })
        emitLocaleToAnalytics(next)
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
