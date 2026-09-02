// deferred deep linking: carry context (locale, invite code, badge campaign identities,
// destination path) from mobile web through the app-store install into the
// native app. android rides the Play Install Referrer; iOS rides a clipboard
// hand-off written on the store-bounce tap and read once on first launch.
// TASK-20772 — the download modal (TASK-20769) is the eventual web consumer.
import { registerPlugin } from '@capacitor/core'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, DEFERRED_LINK_OUTCOMES, type DeferredLinkOutcome } from '@/constants/analytics.consts'
import { PLAY_STORE_URL } from '@/constants/general.consts'
import { isValidLocale } from '@/i18n/config'
import { type AppLocale, resolveLocaleOrNull } from '@/i18n/app/config'
import { isAndroidNative, isIOSNative } from './capacitor'
import { getFromCookie, saveToCookie, sanitizeRedirectURL } from './cookie-url.utils'
import { toInviteCode } from './invite-code.utils'
import { deepLinkToNativePath } from './native-routes'
import {
    BADGE_CAMPAIGN_QUERY_PARAM,
    badgeCampaignIdentitiesFromDeferredSearchParams,
    getPendingBadgeCampaigns,
    parsePendingBadgeCampaigns,
    queuePendingBadgeCampaigns,
} from '@/components/Invites/badge-campaign-context'

// marker param distinguishing our payload from Play's organic referrer
// (utm_source=google-play&utm_medium=organic)
const MARKER = 'pnutdl'
export const CONSUMED_KEY = 'deferredLinkConsumed'

// the key the in-app i18n reads (src/i18n/app/locale-store.ts — Preferences
// on native, cookie/localStorage on web); the restored preference is persisted
// under it so it applies on the next startup resolution.
export const APP_LOCALE_KEY = 'app-locale'

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
    /** Current lossless multi-badge-campaign shape. */
    badgeCampaigns?: string[]
    /** Legacy single-campaign payload accepted during app upgrade. */
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
 * they 404, so they must never survive into a dest. query/hash split off
 * first so /pt-br?x=1 is recognized too.
 */
function stripLocalePrefix(path: string): string {
    const suffixIndex = path.search(/[?#]/)
    const pathname = suffixIndex >= 0 ? path.slice(0, suffixIndex) : path
    const suffix = suffixIndex >= 0 ? path.slice(suffixIndex) : ''
    const [, first, ...rest] = pathname.split('/')
    return first && isValidLocale(first) ? '/' + rest.join('/') + suffix : path
}

/**
 * builds the payload querystring from the current web context: locale from the
 * /{locale}/ path prefix, invite/badge campaign from their existing cookies, dest
 * from the argument (defaults to the current path + query, locale stripped).
 * `invite` overrides the cookie for surfaces that know the code before any
 * cookie is written (the claim page's invite-link CTA).
 */
export function buildDeferredPayload(dest?: string, invite?: string): string {
    const params = new URLSearchParams({ [MARKER]: '1' })

    const firstSegment = window.location.pathname.split('/').filter(Boolean)[0]
    if (firstSegment && isValidLocale(firstSegment)) params.set('lang', firstSegment)

    const inviteCode = invite || getFromCookie('inviteCode')
    if (typeof inviteCode === 'string' && inviteCode) params.set('invite', inviteCode)

    for (const badgeCampaign of getPendingBadgeCampaigns()) {
        params.append(BADGE_CAMPAIGN_QUERY_PARAM, badgeCampaign)
    }

    // a page whose url carries the claim secret in the fragment (#p=) must not
    // ride as a default dest: the fragment never rides (by design), so the
    // restored claim page would render unclaimable. the working path is the
    // user re-tapping the original link — a universal link with the hash intact.
    const secretOnPage = dest === undefined && window.location.hash.startsWith('#p=')
    const destination = dest ?? stripLocalePrefix(window.location.pathname) + window.location.search
    if (destination && destination !== '/' && !secretOnPage) params.set('dest', destination)

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
    const badgeCampaigns = badgeCampaignIdentitiesFromDeferredSearchParams(params)
    return {
        lang: pick('lang'),
        invite: pick('invite'),
        badgeCampaigns: badgeCampaigns.length > 0 ? badgeCampaigns : undefined,
        dest: pick('dest'),
    }
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
 * Records the outcome of the one-shot restore. Only booleans and the channel
 * leave the device — never the invite code, campaign tag or destination, which
 * would put a user's inviter and intended screen into analytics.
 *
 * Swallows everything: this runs on the first-launch path, where a telemetry
 * failure must not cost the user their restored context.
 */
function captureRestore(
    channel: 'referrer' | 'clipboard' | 'none',
    outcome: DeferredLinkOutcome,
    fields?: Record<string, boolean>
): void {
    try {
        posthog.capture(ANALYTICS_EVENTS.DEFERRED_LINK_RESTORED, { channel, outcome, ...fields })
    } catch {}
}

/**
 * Call from the store-bounce tap handler once the hand-off has been written, to
 * give DEFERRED_LINK_RESTORED a denominator — restores alone can't distinguish
 * "the hand-off is broken" from "nobody used it". Intentionally not fired inside
 * `playStoreUrlWithReferrer`/`copyIOSHandoff`: the first is a pure URL builder
 * invoked on render, so it would count impressions as taps.
 * Consumers: the store-bounce handlers in migration.utils (openStore /
 * onStoreAnchorClick); the download modal (TASK-20769) joins them when built.
 */
export function trackDeferredHandoffCreated(platform: 'ios' | 'android'): void {
    try {
        posthog.capture(ANALYTICS_EVENTS.DEFERRED_LINK_HANDOFF_CREATED, { platform })
    } catch {}
}

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

    const channel = isAndroidNative() ? 'referrer' : isIOSNative() ? 'clipboard' : 'none'

    let consumed = false
    const markConsumed = () => {
        consumed = true
        try {
            localStorage.setItem(CONSUMED_KEY, '1')
        } catch {}
    }

    let raw: string | null = null
    // Tracked separately from `raw === null`: a declined paste prompt is a
    // broken hand-off, an empty clipboard is an organic install, and reporting
    // both as "nothing found" is what makes a 0% match rate look like success.
    let clipboardUnavailable = false
    if (isAndroidNative()) {
        raw = await readInstallReferrer()
        // the android read is prompt-free and the referrer stays readable for
        // ~90 days — a transient failure (5s timeout, service unavailable on
        // a busy first boot) resolves null and must NOT burn the one-shot;
        // the next launch retries. a definitive read (incl. play's organic
        // utm string) consumes.
        if (raw !== null) markConsumed()
    } else if (isIOSNative()) {
        try {
            // both gates are prompt-free metadata checks. the hand-off is
            // always a url, so only a probable-web-url clipboard is worth the
            // iOS 16 paste prompt — organic installs with unrelated text
            // (a password, a message draft) are never prompted.
            const { clipboardHasStrings, clipboardHasProbableWebUrl } = await import('./clipboard-detect')
            if ((await clipboardHasStrings()) && (await clipboardHasProbableWebUrl())) {
                // consume BEFORE the prompt-raising read: killing the app while
                // the system paste prompt is up must never cause a re-prompt on
                // the next launch (losing the hand-off is the lesser harm).
                markConsumed()
                const { Clipboard } = await import('@capacitor/clipboard')
                raw = (await Clipboard.read()).value ?? null
            } else {
                markConsumed()
            }
        } catch {
            // user declined the paste prompt, or clipboard unavailable
            markConsumed()
            clipboardUnavailable = true
        }
    } else {
        markConsumed()
    }

    const payload = raw ? parseDeferredPayload(raw) : null
    if (!payload) {
        // an unconsumed one-shot is a transient android referrer failure that
        // the next launch retries — counting it would both duplicate the
        // install and file a broken read as an organic one. `raw` present but
        // unparsed means the marker was absent: an organic Play referrer, or
        // unrelated clipboard text that passed the url gate.
        if (consumed) {
            captureRestore(
                channel,
                raw
                    ? DEFERRED_LINK_OUTCOMES.MARKER_MISSING
                    : clipboardUnavailable
                      ? DEFERRED_LINK_OUTCOMES.CLIPBOARD_UNAVAILABLE
                      : DEFERRED_LINK_OUTCOMES.NO_HANDOFF
            )
        }
        return null
    }

    const restored = applyDeferredPayload(payload)
    captureRestore(channel, DEFERRED_LINK_OUTCOMES.RESTORED, {
        has_dest: !!restored.dest,
        has_locale: !!restored.locale,
        has_invite: !!payload.invite,
        has_campaign: !!(payload.badgeCampaigns?.length || payload.campaign),
    })

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
    // inviteCode: SESSION cookie, exactly matching the web invite flow
    // (InvitesPage). the cookie routes /setup past Landing — the only screen
    // with Log In — so a durable cookie would lock an existing user who
    // installed via a friend's invite link out of login (the PR #2346
    // regression class). session scope keeps attribution for the
    // install→open→signup funnel and self-heals on app restart.
    const invite = payload.invite ? toInviteCode(payload.invite) : ''
    if (invite) saveToCookie('inviteCode', invite)
    // Badge campaigns do not gate the setup step, so they can safely outlive the
    // session for a network/configuration retry. Preserve the first trimmed
    // spelling; backend resolution is case-insensitive.
    const badgeCampaigns = parsePendingBadgeCampaigns(payload.badgeCampaigns ?? payload.campaign)
    if (badgeCampaigns.length > 0) queuePendingBadgeCampaigns(badgeCampaigns, 30)

    // null, not the English fallback: a garbage payload must never override the device language
    const locale = payload.lang ? resolveLocaleOrNull(payload.lang) : null
    if (locale) persistRestoredLocale(locale)

    // must-map, like openDeepLink: an unmappable dest (off-host, malformed
    // encoding) is dropped, never pushed verbatim into the static export
    const rawDest = payload.dest ? stripLocalePrefix(payload.dest) : null
    const mapped = rawDest ? deepLinkToNativePath(rawDest) : null
    const dest = mapped ? sanitizeRedirectURL(mapped) : null
    return { dest, locale }
}
