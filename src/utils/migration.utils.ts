import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { BASE_URL, IS_DEV } from '@/constants/general.consts'
import {
    MIGRATION_CUTOVER_DATE,
    PWA_SUNSET_FLAG,
    STORE_URL,
    type MigrationSurface,
    type StoreKind,
} from '@/constants/migration.consts'
import { isFeatureFlagEnabled } from '@/utils/featureFlag.utils'
import { isCapacitor, openExternalUrl } from '@/utils/capacitor'
import {
    buildDeferredPayload,
    copyIOSHandoff,
    playStoreUrlWithReferrer,
    trackDeferredHandoffCreated,
} from '@/utils/deferred-link'

/** The one place where the flag answers to PostHog and nothing else. NEXT_PUBLIC_BASE_URL
 *  is unset in a bare local checkout, which is why IS_DEV is an independent escape below. */
const IS_PROD_DOMAIN = BASE_URL === 'https://peanut.me'

/**
 * Flag read with a localStorage override that is live everywhere EXCEPT the
 * production domain: `localStorage.setItem('pwa-sunset', 'true')` + reload.
 *
 * Dev alone was not enough. Local dev never inits posthog
 * (instrumentation-client gates on NODE_ENV), but neither does a CI or preview
 * build without NEXT_PUBLIC_POSTHOG_KEY — and the e2e layout gate runs against
 * `next start`, where the dev-only override was inert and every "flag on" case
 * silently measured the flag-off page. Scoping to !IS_PROD_DOMAIN is the same
 * boundary `isFeatureFlagEnabled`'s nonProdBypass already draws, so peanut.me
 * still answers to PostHog and nothing else.
 */
export function isPwaSunsetOn(): boolean {
    if (
        (IS_DEV || !IS_PROD_DOMAIN) &&
        typeof localStorage !== 'undefined' &&
        localStorage.getItem(PWA_SUNSET_FLAG) === 'true'
    ) {
        return true
    }
    return isFeatureFlagEnabled(PWA_SUNSET_FLAG)
}

/**
 * The one sunset-block predicate, shared by every layout that can replace the
 * app with the download screen ((mobile-ui) and (setup)). Public paths are the
 * caller's concern: guest claim/request links must keep working, so the
 * mobile-ui layout passes `isPublic`.
 */
export function shouldShowSunsetBlock({
    migrationOn,
    hasKeepWebBypass,
    isPublic = false,
    now = Date.now(),
}: {
    migrationOn: boolean
    hasKeepWebBypass: boolean
    isPublic?: boolean
    now?: number
}): boolean {
    return migrationOn && !isPublic && !isCapacitor() && !hasKeepWebBypass && now >= getMigrationCutoverTime()
}

/**
 * Cutover timestamp with a dev-only localStorage override
 * (`localStorage.setItem('pwa-sunset-cutover', '2020-01-01')` + reload) so the
 * post-cutover sunset block can be QA'd locally without editing the constant.
 */
export function getMigrationCutoverTime(): number {
    if (IS_DEV && typeof localStorage !== 'undefined') {
        const iso = localStorage.getItem('pwa-sunset-cutover')
        if (iso) {
            const t = new Date(iso).getTime()
            if (!Number.isNaN(t)) return t
        }
    }
    return MIGRATION_CUTOVER_DATE.getTime()
}

/**
 * track a store CTA click without navigating (for anchors that navigate themselves).
 * `qrSurface` is only ever set on the /app smart link, where `surface` is
 * always `smart_link`: it carries the landing surface whose QR produced the
 * scan, so smart-link clicks join back to hero / app fold / footer / rates.
 */
export function trackStoreClick(
    store: StoreKind,
    surface: MigrationSurface,
    handoff = false,
    qrSurface?: MigrationSurface | null
) {
    posthog.capture(ANALYTICS_EVENTS.MIGRATION_STORE_CTA_CLICKED, {
        surface,
        store,
        handoff,
        ...(qrSurface ? { qr_surface: qrSurface } : {}),
    })
}

/** context a bounce surface knows before any cookie is written (claim page invite CTA). */
export interface StoreHandoff {
    invite?: string
    dest?: string
}

/**
 * "Give this QR the ambient deferred context, but I have no destination of my
 * own." The landing lockups (hero, get-the-app fold, footer) want the locale,
 * the invite cookie and any queued badge campaign to ride the scan even though
 * the fold is not sending anyone anywhere in particular — a bare `/app` there
 * would drop a /pt-br visitor's language and their invite code.
 * Module-level and frozen so it keeps a stable identity across renders.
 */
export const AMBIENT_HANDOFF: StoreHandoff = Object.freeze({})

/**
 * navigate to the app store, tracking which surface sent the user there.
 * on web the deferred deep-link payload (TASK-20772) rides along: android via
 * the Play install referrer, iOS via the clipboard hand-off. both the clipboard
 * write and the store open must stay inside the tap gesture — no awaits here.
 */
export function openStore(store: StoreKind, surface: MigrationSurface, handoff?: StoreHandoff) {
    // a native guest is already in the app — nothing to hand off
    if (isCapacitor()) {
        trackStoreClick(store, surface)
        void openExternalUrl(STORE_URL[store])
        return
    }

    let payload = ''
    try {
        payload = buildDeferredPayload(handoff?.dest, handoff?.invite)
    } catch {
        // a payload failure must never block the store bounce itself
    }
    trackStoreClick(store, surface, !!payload)

    if (store === 'android') {
        // the referrer url IS the written hand-off — count it here, at the tap
        if (payload) trackDeferredHandoffCreated('android')
        void openExternalUrl(payload ? playStoreUrlWithReferrer(payload) : STORE_URL[store])
        return
    }
    // clipboard write is prompt-free on the web side; the app asks on first launch
    if (payload)
        void copyIOSHandoff(payload)
            .then(() => trackDeferredHandoffCreated('ios'))
            .catch(() => {})
    void openExternalUrl(STORE_URL[store])
}

/**
 * href for a store CTA that is a real anchor and navigates itself: android
 * carries the hand-off in the url; iOS can't (the clipboard needs the tap) —
 * pair with onStoreAnchorClick, passing it the SAME handoff so both channels
 * carry the same context. never preventDefault such an anchor: its own
 * navigation is the fallback that still works where window.open is suppressed
 * (in-app browsers, strict popup blockers).
 */
export function storeAnchorHref(store: StoreKind, handoff?: StoreHandoff): string {
    if (!isCapacitor() && store === 'android') {
        try {
            return playStoreUrlWithReferrer(buildDeferredPayload(handoff?.dest, handoff?.invite))
        } catch {
            // fall through to the bare url — the bounce itself never breaks
        }
    }
    return STORE_URL[store]
}

/** tracking + iOS clipboard hand-off for a self-navigating store anchor. */
export function onStoreAnchorClick(store: StoreKind, surface: MigrationSurface, handoff?: StoreHandoff) {
    if (isCapacitor()) {
        trackStoreClick(store, surface)
        return
    }
    let payload = ''
    try {
        payload = buildDeferredPayload(handoff?.dest, handoff?.invite)
    } catch {}
    trackStoreClick(store, surface, !!payload)
    if (store === 'ios' && payload)
        void copyIOSHandoff(payload)
            .then(() => trackDeferredHandoffCreated('ios'))
            .catch(() => {})
    // the anchor's href (built at render) carries the android hand-off; a
    // successful rebuild here is the same approximation trackStoreClick uses
    if (store === 'android' && payload) trackDeferredHandoffCreated('android')
}
