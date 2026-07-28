// deferred deep linking: carry context (locale, invite code, campaign tag,
// destination path) from mobile web through the app-store install into the
// native app. android rides the Play Install Referrer; iOS rides a clipboard
// hand-off written on the store-bounce tap and read once on first launch.
// TASK-20772 — the download modal (TASK-20769) is the eventual web consumer.
import { registerPlugin } from '@capacitor/core'
import { PLAY_STORE_URL } from '@/constants/general.consts'
import { isValidLocale } from '@/i18n/config'
import { isAndroidNative, isIOSNative } from './capacitor'
import { getFromCookie, saveToCookie, sanitizeRedirectURL } from './general.utils'
import { deepLinkToNativePath } from './native-routes'

// marker param distinguishing our payload from Play's organic referrer
// (utm_source=google-play&utm_medium=organic)
const MARKER = 'pnutdl'
export const CONSUMED_KEY = 'deferredLinkConsumed'

// the key the in-app i18n reads (dev branch: src/i18n/app/locale-store.ts —
// Preferences on native, cookie/localStorage on web). we persist the restored
// preference under it so it applies the moment that system lands on main.
// when it does, replace the mini-resolver below with its resolveLocale.
export const APP_LOCALE_KEY = 'app-locale'
const APP_LOCALES = ['en', 'es-419', 'pt-BR'] as const
type AppLocale = (typeof APP_LOCALES)[number]

/** normalizes a BCP 47-ish tag to a supported app locale; null when the
 * language is unsupported (a garbage payload must never override the device
 * language). */
function resolveAppLocale(raw: string): AppLocale | null {
    const tag = raw.trim().toLowerCase()
    const exact = APP_LOCALES.find((l) => l.toLowerCase() === tag)
    if (exact) return exact
    const lang = tag.split('-')[0]
    if (lang === 'en') return 'en'
    if (lang === 'es') return 'es-419'
    if (lang === 'pt') return 'pt-BR'
    return null
}

function persistRestoredLocale(locale: AppLocale): void {
    try {
        localStorage.setItem(APP_LOCALE_KEY, locale)
    } catch {}
    // fire-and-forget: the plugin ships in this binary; older binaries
    // running OTA'd JS just skip native persistence
    import('@capacitor/preferences')
        .then(({ Preferences }) => Preferences.set({ key: APP_LOCALE_KEY, value: locale }))
        .catch(() => {})
}

export interface DeferredPayload {
    lang?: string
    invite?: string
    campaign?: string
    dest?: string
}

// app-local android plugin (InstallReferrerPlugin.java); throws "not
// implemented" on iOS/web and on older binaries running OTA'd JS — callers
// catch and treat as null.
const InstallReferrer = registerPlugin<{ getReferrer(): Promise<{ referrer: string | null }> }>('InstallReferrer')

/** raw play install referrer string, or null anywhere it can't be read. */
export async function readInstallReferrer(): Promise<string | null> {
    try {
        return (await InstallReferrer.getReferrer()).referrer ?? null
    } catch {
        // older binary without the plugin, iOS/web, or referrer service unavailable
        return null
    }
}

// ---------------------------------------------------------------------------
// web side — building the hand-off
// ---------------------------------------------------------------------------

/**
 * strips a leading marketing locale segment (/es-419/claim/X → /claim/X).
 * locale-prefixed routes only exist on the web — in the native static export
 * they 404, so they must never survive into a dest.
 */
function stripLocalePrefix(path: string): string {
    const [, first, ...rest] = path.split('/')
    return first && isValidLocale(first) ? '/' + rest.join('/') : path
}

/**
 * builds the payload querystring from the current web context: locale from the
 * /{locale}/ path prefix, invite/campaign from their existing cookies, dest
 * from the argument (defaults to the current path + query, locale stripped).
 */
export function buildDeferredPayload(dest?: string): string {
    const params = new URLSearchParams({ [MARKER]: '1' })

    const firstSegment = window.location.pathname.split('/').filter(Boolean)[0]
    if (firstSegment && isValidLocale(firstSegment)) params.set('lang', firstSegment)

    const invite = getFromCookie('inviteCode')
    if (typeof invite === 'string' && invite) params.set('invite', invite)

    const campaign = getFromCookie('campaignTag')
    if (typeof campaign === 'string' && campaign) params.set('campaign', campaign)

    const destination = dest ?? stripLocalePrefix(window.location.pathname) + window.location.search
    if (destination && destination !== '/') params.set('dest', destination)

    return params.toString()
}

/** play store listing url with the payload riding the install referrer. */
export function playStoreUrlWithReferrer(payload: string): string {
    return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(payload)}`
}

/**
 * the iOS clipboard hand-off string — a full peanut.me url so a stray paste
 * anywhere else is still a working link.
 */
export function iosHandoffString(payload: string): string {
    return `https://peanut.me/?${payload}`
}

/**
 * copies the iOS hand-off to the clipboard. MUST be called from the store-
 * bounce tap handler — clipboard writes need a user gesture on the web.
 */
export async function copyIOSHandoff(payload: string): Promise<void> {
    await navigator.clipboard.writeText(iosHandoffString(payload))
}

// ---------------------------------------------------------------------------
// shared — parsing
// ---------------------------------------------------------------------------

/**
 * parses a raw referrer string or a full hand-off url into a payload.
 * returns null unless the pnutdl marker is present.
 */
export function parseDeferredPayload(raw: string): DeferredPayload | null {
    const qIndex = raw.indexOf('?')
    const qs = qIndex >= 0 ? raw.slice(qIndex + 1) : raw
    let params: URLSearchParams
    try {
        params = new URLSearchParams(qs)
    } catch {
        return null
    }
    if (params.get(MARKER) !== '1') return null
    const pick = (key: string) => params.get(key) || undefined
    return { lang: pick('lang'), invite: pick('invite'), campaign: pick('campaign'), dest: pick('dest') }
}

// ---------------------------------------------------------------------------
// native side — one-shot restore on first launch
// ---------------------------------------------------------------------------

export interface RestoredContext {
    /** sanitized in-app path to navigate to, or null */
    dest: string | null
    /** normalized app locale that was persisted, or null */
    locale: AppLocale | null
}

let restoreInFlight: Promise<RestoredContext | null> | null = null

/**
 * one-shot first-launch restore. reads the platform hand-off (android install
 * referrer / iOS clipboard), applies invite + campaign cookies, persists the
 * locale preference, and returns the destination for the caller to navigate
 * to. the consumed flag is set even when nothing is found, so the iOS paste
 * prompt can never fire twice.
 */
export function restoreDeferredContext(): Promise<RestoredContext | null> {
    // in-flight guard: overlapping calls (react strict-mode double-effect,
    // effect re-runs) share one read so the iOS paste prompt can't stack
    if (!restoreInFlight) {
        restoreInFlight = doRestore().finally(() => {
            restoreInFlight = null
        })
    }
    return restoreInFlight
}

async function doRestore(): Promise<RestoredContext | null> {
    try {
        if (localStorage.getItem(CONSUMED_KEY)) return null
    } catch {
        return null
    }

    let raw: string | null = null
    if (isAndroidNative()) {
        raw = await readInstallReferrer()
    } else if (isIOSNative()) {
        try {
            // both gates are prompt-free metadata checks. the hand-off is
            // always a url, so only a probable-web-url clipboard is worth the
            // iOS 16 paste prompt — organic installs with unrelated text
            // (a password, a message draft) are never prompted.
            const { clipboardHasStrings, clipboardHasProbableWebUrl } = await import('./clipboard-detect')
            if ((await clipboardHasStrings()) && (await clipboardHasProbableWebUrl())) {
                const { Clipboard } = await import('@capacitor/clipboard')
                raw = (await Clipboard.read()).value ?? null
            }
        } catch {
            // user declined the paste prompt, or clipboard unavailable
        }
    }

    // one shot, even on failure: android's referrer stays readable for months
    // and iOS must never re-prompt
    try {
        localStorage.setItem(CONSUMED_KEY, '1')
    } catch {}

    const payload = raw ? parseDeferredPayload(raw) : null
    if (!payload) return null

    const restored = applyDeferredPayload(payload)

    // privacy: clear the consumed hand-off off the clipboard. after the flag —
    // an interrupted clear can't cause a re-read. single space: some platforms
    // reject writing an empty string.
    if (isIOSNative()) {
        try {
            const { Clipboard } = await import('@capacitor/clipboard')
            await Clipboard.write({ string: ' ' })
        } catch {}
    }

    return restored
}

/**
 * applies a parsed payload (cookies + locale persistence) and returns the
 * sanitized destination + normalized locale. shared by the real restore and
 * the /dev/deferred simulator so there is exactly one apply path.
 */
export function applyDeferredPayload(payload: DeferredPayload): RestoredContext {
    // normalize like every existing writer (InvitesPage lowercases ?code and
    // utm_campaign; toInviteCode trims/strips @) — a hand-built referrer with
    // an uppercase tag must not break the case-sensitive badge award.
    // 30-day expiry matches useZeroDev's invite cookie: a session cookie would
    // be dropped by the webview before the user finishes signup, and the
    // one-shot consumed flag means it could never be re-read.
    const invite = payload.invite?.trim().replace(/^@/, '').toLowerCase()
    if (invite) saveToCookie('inviteCode', invite, 30)
    const campaign = payload.campaign?.trim().toLowerCase()
    if (campaign) saveToCookie('campaignTag', campaign, 30)

    const locale = payload.lang ? resolveAppLocale(payload.lang) : null
    if (locale) persistRestoredLocale(locale)

    const rawDest = payload.dest ? stripLocalePrefix(payload.dest) : null
    const dest = rawDest ? sanitizeRedirectURL(deepLinkToNativePath(rawDest) ?? rawDest) : null
    return { dest, locale }
}
