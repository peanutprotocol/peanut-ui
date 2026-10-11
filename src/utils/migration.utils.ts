import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { BASE_URL, IS_DEV } from '@/constants/general.consts'
import { PWA_SUNSET_FLAG, STORE_URL, type MigrationSurface, type StoreKind } from '@/constants/migration.consts'
import { isFeatureFlagEnabled } from '@/utils/featureFlag.utils'
import { DeviceType } from '@/hooks/useGetDeviceType'
import { isCapacitor, openExternalUrl } from '@/utils/capacitor'
import {
    buildDeferredPayload,
    copyIOSHandoff,
    playStoreUrlWithReferrer,
    trackDeferredHandoffCreated,
} from '@/utils/deferred-link'

const IS_PROD_DOMAIN = BASE_URL === 'https://peanut.me'

/**
 * Every Vercel preview deployment keeps the web signup flow while the
 * production PWA sunset flag is enabled: ad-hoc PR previews are temporary
 * review environments, and the `dev` branch preview backs staging, where the
 * team still creates accounts. Both read the production PostHog project, so
 * the flag alone cannot tell them apart from peanut.me.
 *
 * Require a git ref as well as VERCEL_ENV: local visual builds set only
 * NEXT_PUBLIC_VERCEL_ENV=preview to enable fixtures and must keep following
 * the flag.
 */
function isVercelPreviewDeployment(): boolean {
    return process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' && Boolean(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF)
}

/**
 * Read the flag from PostHog. Local, CI, staging and preview builds also
 * accept localStorage['pwa-sunset'] = 'true' because PostHog may be
 * unavailable there, and because it is how QA forces the migration state on
 * a deployment that otherwise ignores the flag. Production builds for
 * peanut.me ignore the override.
 */
export function isPwaSunsetOn(): boolean {
    if (
        (IS_DEV || !IS_PROD_DOMAIN) &&
        typeof localStorage !== 'undefined' &&
        localStorage.getItem(PWA_SUNSET_FLAG) === 'true'
    ) {
        return true
    }
    if (isVercelPreviewDeployment()) return false
    return isFeatureFlagEnabled(PWA_SUNSET_FLAG)
}

/** The store this device downloads from. Desktop has none: it gets the QR code instead. */
export function storeForDevice(deviceType: DeviceType): StoreKind | null {
    if (deviceType === DeviceType.IOS) return 'ios'
    if (deviceType === DeviceType.ANDROID) return 'android'
    return null
}

/** The icon on a download button: the visitor's store, or a QR code on desktop. */
export function storeIcon(store: StoreKind | null): 'apple-logo' | 'google-play' | 'qr-code' {
    if (store === 'ios') return 'apple-logo'
    if (store === 'android') return 'google-play'
    return 'qr-code'
}

/** Track a store CTA click without navigating (for anchors that navigate themselves). */
export function trackStoreClick(store: StoreKind, surface: MigrationSurface, handoff = false) {
    posthog.capture(ANALYTICS_EVENTS.MIGRATION_STORE_CTA_CLICKED, { surface, store, handoff })
}

/** Invite or destination known by the CTA, before it is saved in a cookie. */
export interface StoreHandoff {
    invite?: string
    dest?: string
}

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
        payload = buildDeferredPayload(handoff?.dest, handoff?.invite, store)
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
 * Store anchor URL with an Android install referrer.
 * Pair with onStoreAnchorClick for tracking and the iOS clipboard handoff.
 * Keep the anchor's default navigation so it works when popups are blocked.
 */
export function storeAnchorHref(store: StoreKind): string {
    if (!isCapacitor() && store === 'android') {
        try {
            return playStoreUrlWithReferrer(buildDeferredPayload(undefined, undefined, 'android'))
        } catch {
            // fall through to the bare url — the bounce itself never breaks
        }
    }
    return STORE_URL[store]
}

/** Track a store anchor click and write its iOS clipboard handoff. */
export function onStoreAnchorClick(store: StoreKind, surface: MigrationSurface) {
    if (isCapacitor()) {
        trackStoreClick(store, surface)
        return
    }
    let payload = ''
    try {
        payload = buildDeferredPayload(undefined, undefined, store)
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
