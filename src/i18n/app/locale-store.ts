// Runtime locale resolution, mirroring the auth-token.ts pattern:
// web: cookie (+ localStorage mirror); capacitor: native Preferences with the
// device language as default. Every raw tag passes through resolveLocale so
// an unsupported value can never leak out.

import Cookies from 'js-cookie'
import { isCapacitor } from '@/utils/capacitor'
import { resolveLocale, type AppLocale } from './config'

const LOCALE_KEY = 'app-locale'

let resolution: Promise<AppLocale> | null = null

function navigatorLocale(): AppLocale {
    return resolveLocale(typeof navigator !== 'undefined' ? navigator.language : null)
}

async function resolveStartupLocale(): Promise<AppLocale> {
    if (isCapacitor()) {
        try {
            const { Preferences } = await import('@capacitor/preferences')
            const { value } = await Preferences.get({ key: LOCALE_KEY })
            if (value) return resolveLocale(value)
        } catch {
            // plugin unavailable — fall through to device language
        }
        try {
            const { Device } = await import('@capacitor/device')
            const { value } = await Device.getLanguageTag()
            return resolveLocale(value)
        } catch {
            // older binary running OTA'd JS without @capacitor/device
            return navigatorLocale()
        }
    }
    const stored =
        Cookies.get(LOCALE_KEY) ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_KEY) : null)
    if (stored) return resolveLocale(stored)
    return navigatorLocale()
}

/** Resolves the startup locale once; memoized for the session. */
export function localeReady(): Promise<AppLocale> {
    if (!resolution) resolution = resolveStartupLocale()
    return resolution
}

export function persistLocale(locale: AppLocale): void {
    if (isCapacitor()) {
        import('@capacitor/preferences')
            .then(({ Preferences }) => Preferences.set({ key: LOCALE_KEY, value: locale }))
            .catch(() => {})
        return
    }
    Cookies.set(LOCALE_KEY, locale, { expires: 365, path: '/' })
    try {
        localStorage.setItem(LOCALE_KEY, locale)
    } catch {
        // storage may be unavailable (private mode); cookie is authoritative
    }
}

let markApplied: (() => void) | null = null
const applied = new Promise<void>((resolve) => {
    markApplied = resolve
})

/**
 * Resolves once the startup locale has been rendered by AppIntlProvider.
 * The native splash screen awaits this (with a timeout guard) so users never
 * see an English flash before their locale applies.
 */
export function localeApplied(): Promise<void> {
    return applied
}

export function markLocaleApplied(): void {
    markApplied?.()
}
