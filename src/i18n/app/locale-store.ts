// Runtime locale resolution, mirroring the auth-token.ts pattern:
// web: cookie (+ localStorage mirror); capacitor: the device language (which
// includes the per-app language in iOS/Android settings) unless the user picked
// one in-app since it last changed. Every raw tag passes through resolveLocale
// so an unsupported value can never leak out.

import Cookies from 'js-cookie'
import posthog from 'posthog-js'
import { APP_RELEASE } from '@/constants/app-release'
import { getPlatform, isCapacitor, isNativeBridge } from '@/utils/capacitor'
import { resolveDeviceIdentity, type DeviceIdentity } from '@/utils/device-identity'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'
import { resolveLocale, resolveLocaleOrNull, type AppLocale } from './config'

const LOCALE_KEY = 'app-locale'
// Native only: the raw device language tag an in-app pick was made under.
const PICKED_UNDER_KEY = 'app-locale-device'

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
    for (const tag of typeof navigator !== 'undefined' ? (navigator.languages ?? []) : []) {
        const locale = resolveLocaleOrNull(tag)
        if (locale) return locale
    }
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
export function rawDeviceTag(): Promise<string | null> {
    return deviceLanguage().then(({ tag }) => tag)
}

/** `fromBridge` is false when the tag is the navigator fallback, not the OS answer. */
type DeviceLanguage = { tag: string; fromBridge: true } | { tag: string | null; fromBridge: false }

let startupDeviceLanguage: Promise<DeviceLanguage> | null = null
function deviceLanguage(): Promise<DeviceLanguage> {
    if (!startupDeviceLanguage) startupDeviceLanguage = readDeviceLanguage()
    return startupDeviceLanguage
}
async function readDeviceLanguage(): Promise<DeviceLanguage> {
    if (isCapacitor()) {
        let timeout: ReturnType<typeof setTimeout> | undefined
        try {
            const value = await Promise.race([
                import('@capacitor/device').then(async ({ Device }) => (await Device.getLanguageTag()).value),
                new Promise<null>((resolve) => {
                    timeout = setTimeout(() => resolve(null), 1500)
                }),
            ])
            if (value) return { tag: value, fromBridge: true }
        } catch {
            // older binary / plugin missing — fall through to navigator
        } finally {
            clearTimeout(timeout)
        }
    }
    return { tag: typeof navigator !== 'undefined' ? navigator.language : null, fromBridge: false }
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
} & Partial<DeviceIdentity>

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

    await registerDeviceIdentity()
}

/**
 * Registered as its own step rather than folded into the context above: the
 * native branch is a second bridge round-trip, and a binary whose plugin never
 * answers would otherwise take `platform` and `app_release` down with it.
 * Person properties as well as super properties — a cohort of slow devices is a
 * person-level question, and `identified_only` means only identified users get
 * a profile to write to.
 */
async function registerDeviceIdentity(): Promise<void> {
    try {
        const identity = await resolveDeviceIdentity()
        posthog.register(identity)
        // Covers the identity resolving after login. The other order — a login
        // that lands after this — is covered by authContext folding
        // currentDeviceIdentity() into its identify payload, because a visitor
        // who was still anonymous here gets no $set at all.
        if (posthog._isIdentified()) posthog.setPersonProperties(identity)
        deviceIdentity = identity
        if (deviceContext) deviceContext = { ...deviceContext, ...identity }
    } catch {
        // analytics failure degrades to missing data, never a broken app
    }
}

let deviceIdentity: DeviceIdentity | null = null

/** Resolved device identity, for the identify payload; null until it resolves. */
export function currentDeviceIdentity(): DeviceIdentity | null {
    return deviceIdentity
}

async function resolveStartupLocale(): Promise<AppLocale> {
    if (isCapacitor()) return resolveNativeLocale()
    const stored = Cookies.get(LOCALE_KEY) ?? readStoredValue(LOCALE_KEY)
    if (stored) return resolveLocale(stored)
    return navigatorLocale()
}

/**
 * An in-app pick holds until the device moves to a different supported
 * language — a new phone language, or the per-app language in iOS/Android
 * settings. That is the newer choice and the pick is dropped.
 */
async function resolveNativeLocale(): Promise<AppLocale> {
    // shares the memoized bridge call with the analytics emit
    const device = await deviceLanguage()
    const deviceLocale = resolveLocale(device.tag)
    try {
        const { Preferences } = await import('@capacitor/preferences')
        const [{ value: picked }, { value: pickedUnder }] = await Promise.all([
            Preferences.get({ key: LOCALE_KEY }),
            Preferences.get({ key: PICKED_UNDER_KEY }),
        ])
        if (!picked) return deviceLocale
        const pickedLocale = resolveLocale(picked)
        // the navigator fallback is no evidence that the device locale moved
        if (!device.fromBridge) return pickedLocale
        if (!pickedUnder) {
            // Unpaired: an older bundle's first-launch write or pick, or a deferred
            // link. One matching the device is dropped so the device language
            // applies from now on; any other value was a pick, paired with today's
            // device language.
            if (pickedLocale === deviceLocale) tidyNativePick(() => Preferences.remove({ key: LOCALE_KEY }))
            else tidyNativePick(() => Preferences.set({ key: PICKED_UNDER_KEY, value: device.tag }))
            return pickedLocale
        }
        if (!deviceMovedSince(pickedUnder, device.tag)) return pickedLocale
        tidyNativePick(() =>
            Promise.all([Preferences.remove({ key: LOCALE_KEY }), Preferences.remove({ key: PICKED_UNDER_KEY })])
        )
        return deviceLocale
    } catch {
        // plugin unavailable — the device language
        return deviceLocale
    }
}

/**
 * Compared on raw tags, not resolveLocale: an unsupported language falls back
 * to English there, so fr-FR → en-US would read as no move. A move onto an
 * unsupported language asks for no app language and leaves the pick alone.
 */
function deviceMovedSince(pickedUnder: string, deviceTag: string): boolean {
    const now = resolveLocaleOrNull(deviceTag)
    return now !== null && now !== resolveLocaleOrNull(pickedUnder)
}

// Off the splash path, and never over a pick made this session.
function tidyNativePick(write: () => Promise<unknown>): void {
    if (explicitlyChosen) return
    write().catch(() => {})
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
                // full document load re-derived it and the proxy saw no cookie.
                // An explicit choice made meanwhile wins. Native stores only picks,
                // or the device language setting would stop applying.
                if (!explicitlyChosen && !isCapacitor()) writeLocale(resolved)
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

// Web only: an explicit pick the account has not saved yet. Stored, not held in
// memory, so a pick made signed out or before a reload still reaches the
// account as a pick after sign-in. The phone app sends its language anyway.
const PENDING_PICK_KEY = 'app-locale-pick-pending'

/** An explicit choice (switcher, suggestion banner): outranks the startup write. */
export function persistLocale(locale: AppLocale): void {
    explicitlyChosen = true
    if (!isCapacitor()) writeStoredValue(PENDING_PICK_KEY, locale)
    writeLocale(locale)
}

/** Web: the explicit pick the account has not saved yet, or null. */
export function pendingLocalePick(): string | null {
    return readStoredValue(PENDING_PICK_KEY)
}

export function clearPendingLocalePick(): void {
    removeStoredValue(PENDING_PICK_KEY)
}

function writeLocale(locale: AppLocale): void {
    if (isCapacitor()) {
        void saveNativePick(locale)
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

/**
 * Pairs the pick with the device language it was made under. Until the pairing
 * lands (or when the bridge read fails) the pick is unpaired, which startup
 * pairs with its own bridge read rather than dropping.
 */
async function saveNativePick(locale: AppLocale): Promise<void> {
    try {
        const { Preferences } = await import('@capacitor/preferences')
        await Preferences.remove({ key: PICKED_UNDER_KEY })
        await Preferences.set({ key: LOCALE_KEY, value: locale })
        // not the startup memo: Android keeps the process alive across a language change
        const device = await readDeviceLanguage()
        if (device.fromBridge) await Preferences.set({ key: PICKED_UNDER_KEY, value: device.tag })
    } catch {
        // plugin unavailable — the pick lasts this session only
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
