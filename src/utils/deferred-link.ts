// deferred deep linking: carry context (locale, invite code, campaign tag,
// destination path) from mobile web through the app-store install into the
// native app. android rides the Play Install Referrer; iOS rides a clipboard
// hand-off written on the store-bounce tap and read once on first launch.
// TASK-20772 — the download modal (TASK-20769) is the eventual web consumer.
import { registerPlugin } from '@capacitor/core'
import { PLAY_STORE_URL } from '@/constants/general.consts'
import { isValidLocale } from '@/i18n/config'
import { APP_LOCALES, resolveLocale, type AppLocale } from '@/i18n/app/config'
import { isAndroidNative, isIOSNative } from './capacitor'
import { clipboardHasStrings } from './clipboard-detect'
import { getFromCookie, saveToCookie, sanitizeRedirectURL } from './general.utils'
import { deepLinkToNativePath } from './native-routes'

// marker param distinguishing our payload from Play's organic referrer
// (utm_source=google-play&utm_medium=organic)
const MARKER = 'pnutdl'
export const CONSUMED_KEY = 'deferredLinkConsumed'

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
 * builds the payload querystring from the current web context: locale from the
 * /{locale}/ path prefix, invite/campaign from their existing cookies, dest
 * from the argument (defaults to the current path + query).
 */
export function buildDeferredPayload(dest?: string): string {
    const params = new URLSearchParams({ [MARKER]: '1' })

    const firstSegment = window.location.pathname.split('/').filter(Boolean)[0]
    if (firstSegment && isValidLocale(firstSegment)) params.set('lang', firstSegment)

    const invite = getFromCookie('inviteCode')
    if (typeof invite === 'string' && invite) params.set('invite', invite)

    const campaign = getFromCookie('campaignTag')
    if (typeof campaign === 'string' && campaign) params.set('campaign', campaign)

    const destination = dest ?? window.location.pathname + window.location.search
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
    /** normalized app locale to apply via setLocale, or null */
    locale: AppLocale | null
}

/**
 * one-shot first-launch restore. reads the platform hand-off (android install
 * referrer / iOS clipboard), applies invite + campaign cookies, and returns
 * the destination + locale for the caller to act on (locale goes through
 * useAppLocale().setLocale so it applies live AND persists). the consumed
 * flag is set even when nothing is found, so the iOS paste prompt can never
 * fire twice.
 */
export async function restoreDeferredContext(): Promise<RestoredContext | null> {
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
            // prompt-free presence check first, so organic installs with an
            // empty clipboard never see the iOS 16 paste prompt
            if (await clipboardHasStrings()) {
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
 * applies a parsed payload (cookies) and returns the sanitized destination +
 * normalized locale. shared by the real restore and the /dev/deferred
 * simulator so there is exactly one apply path. the locale is returned rather
 * than persisted here: only useAppLocale().setLocale both persists and
 * re-renders the running session.
 */
export function applyDeferredPayload(payload: DeferredPayload): RestoredContext {
    if (payload.invite) saveToCookie('inviteCode', payload.invite)
    if (payload.campaign) saveToCookie('campaignTag', payload.campaign)

    // resolveLocale maps any unknown tag to 'en', which would override the
    // device language — only pass through tags whose language is supported
    const supportedLangs = APP_LOCALES.map((l) => l.split('-')[0])
    const langPrefix = payload.lang?.trim().toLowerCase().split('-')[0]
    const locale = langPrefix && supportedLangs.includes(langPrefix) ? resolveLocale(payload.lang) : null

    const dest = payload.dest ? sanitizeRedirectURL(deepLinkToNativePath(payload.dest) ?? payload.dest) : null
    return { dest, locale }
}
