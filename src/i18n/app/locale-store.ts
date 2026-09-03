// Runtime locale resolution, mirroring the auth-token.ts pattern:
// web: cookie (+ localStorage mirror); capacitor: native Preferences with the
// device language as default. Every raw tag passes through resolveLocale so
// an unsupported value can never leak out.

import Cookies from 'js-cookie'
import posthog from 'posthog-js'
import { APP_RELEASE } from '@/constants/app-release'
import { getPlatform, isCapacitor, isNativeBridge } from '@/utils/capacitor'
import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'
import { resolveLocale, type AppLocale } from './config'

const LOCALE_KEY = 'app-locale'

let resolution: Promise<AppLocale> | null = null
let current: AppLocale | null = null

/** Last locale emitted to analytics (= last applied), or null before startup. */
export function currentAppLocale(): AppLocale | null {
    return current
}

// Locale analytics (TASK-20922). AppIntlProvider calls this once the locale is
// actually rendered — never on a persist whose catalog load failed — so
// analytics report the language the user saw. register makes app_locale an
// event-time super property (person-on-events preserves history). The person
// property ($set) is written only on a real change by an identified user: the
// startup value reaches the person profile via the identify in authContext.tsx
// (which sends app_locale), and an unconditional $set would force person
// processing for every anonymous visitor under 'identified_only'. Analytics
// must never break i18n, so the posthog calls are fenced.
export function emitLocaleToAnalytics(locale: AppLocale): void {
    if (locale === current) return
    const isChange = current !== null
    current = locale
    try {
        posthog.register({ app_locale: locale })
        if (isChange && posthog._isIdentified()) posthog.setPersonProperties({ app_locale: locale })
    } catch {
        // analytics failure degrades to missing data, never a broken locale
    }
}

function navigatorLocale(): AppLocale {
    return resolveLocale(typeof navigator !== 'undefined' ? navigator.language : null)
}

/**
 * Raw device/browser language tag — deliberately NOT run through resolveLocale.
 * An unsupported language (e.g. 'fr-FR') must stay itself for the localization
 * OKR, not collapse to 'en' and pollute the "phone set to ES/PT" denominator.
 * Memoized: the native Device.getLanguageTag() bridge call sits on the
 * splash-gated startup path, so the locale resolver and the analytics emit
 * share one round-trip instead of each making their own.
 */
let deviceTag: Promise<string | null> | null = null
function rawDeviceTag(): Promise<string | null> {
    if (!deviceTag) deviceTag = readDeviceTag()
    return deviceTag
}
async function readDeviceTag(): Promise<string | null> {
    if (isCapacitor()) {
        try {
            const { Device } = await import('@capacitor/device')
            const { value } = await Device.getLanguageTag()
            if (value) return value
        } catch {
            // older binary / plugin missing — fall through to navigator
        }
    }
    return typeof navigator !== 'undefined' ? navigator.language : null
}

// Device context for the localization OKR (Fit metric): device_language is the
// language the user's phone asks for; app_locale (above) is what they actually
// use. Both are super properties so every event carries them — the OKR filters
// device_language ∈ {es*, pt*} and reads the app_locale=en override rate, no
// KYC/nationality join. The resolved context is cached (not just a bool) so the
// logout handler can re-register it after posthog.reset() wipes super
// properties, mirroring app_locale. Fenced so analytics can never break the app.
// binary_version / binary_build are the native shell's own version (app_release
// is the JS bundle's), present only on the native bridge; they are what splits
// a per-build failure rate across shells.
type DeviceContext = {
    device_language: string
    platform: string
    app_release: string
    binary_version?: string
    binary_build?: string
}

let deviceContext: DeviceContext | null = null

/** Last device context registered — for re-register after posthog.reset() on logout. */
export function currentDeviceContext(): DeviceContext | null {
    return deviceContext
}

export async function emitDeviceContextToAnalytics(): Promise<void> {
    if (deviceContext) return
    try {
        const tag = await rawDeviceTag()
        const context: DeviceContext = {
            device_language: tag ? tag.trim().toLowerCase() : 'unknown',
            platform: getPlatform(),
            // Also registered in posthog.init's `loaded` callback, which is what
            // covers the initial $pageview. Repeated here so a logout's
            // posthog.reset() — which wipes super properties — re-registers it
            // along with the rest of this context.
            app_release: APP_RELEASE,
        }
        if (isNativeBridge()) {
            const { getBinaryInfo } = await import('@/utils/app-version')
            const binary = await getBinaryInfo()
            if (binary) {
                context.binary_version = binary.appVersion
                context.binary_build = binary.appBuild
            }
        }
        posthog.register(context)
        // set only after a successful register — a throw leaves this null so a
        // later call can retry, instead of silently disabling the emit forever
        deviceContext = context
    } catch {
        // analytics failure degrades to missing data, never a broken app
    }
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
        // shares the memoized bridge call with the analytics emit
        return resolveLocale(await rawDeviceTag())
    }
    const stored = Cookies.get(LOCALE_KEY) ?? readStoredValue(LOCALE_KEY)
    if (stored) return resolveLocale(stored)
    return navigatorLocale()
}

/**
 * Resolves the startup locale once; memoized for the session. The catch is
 * what makes memoizing safe: a rejected promise cached here would leave every
 * later awaiter — AppIntlProvider included — hanging on a failure it has no
 * handler for.
 */
export function localeReady(): Promise<AppLocale> {
    if (!resolution)
        resolution = resolveStartupLocale()
            .then((resolved) => {
                // A locale derived from the browser language was never stored, so a
                // full document load (a PWA relaunch at start_url) re-derived it and
                // the proxy saw no cookie. An explicit choice made meanwhile wins.
                if (!explicitlyChosen) writeLocale(resolved)
                return resolved
            })
            .catch((err) => {
                // the unhandled rejection was the only signal that startup locale
                // resolution had failed (PEANUT-UI-STC); neither caller handles it,
                // so warn to keep captureConsoleIntegration reporting the next one
                console.warn('Startup locale resolution failed; falling back to the browser language', err)
                return navigatorLocale()
            })
    return resolution
}

let explicitlyChosen = false

/** An explicit choice (switcher, suggestion banner): outranks the startup write. */
export function persistLocale(locale: AppLocale): void {
    explicitlyChosen = true
    writeLocale(locale)
}

function writeLocale(locale: AppLocale): void {
    if (isCapacitor()) {
        import('@capacitor/preferences')
            .then(({ Preferences }) => Preferences.set({ key: LOCALE_KEY, value: locale }))
            .catch(() => {})
        return
    }
    try {
        // document.cookie throws in a sandboxed/opaque-origin document, and this
        // runs straight off a LocaleSwitcher onClick with no handler upstream
        Cookies.set(LOCALE_KEY, locale, { expires: 365, path: '/' })
    } catch {
        // storage below is the only remaining mirror
    }
    // storage may be unavailable (private mode); cookie is authoritative
    writeStoredValue(LOCALE_KEY, locale)
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
